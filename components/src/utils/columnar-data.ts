// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// LOGZ.IO ADDITION:: columnar chart data [unidash-perf]
// Grafana-style storage for time-series panels: ONE shared time column plus one Float64Array per
// series (NaN = gap), fed to ECharts as a single column-object dataset. This replaces the previous
// per-series `[timestamp, value]` tuple arrays — which duplicated every timestamp per series,
// materialized null gap-filler tuples for the whole timeline, and were then re-copied into per-series
// dataset sources — with typed arrays ECharts ingests on its fast path (~16 bytes/point, no per-point
// JS objects for the GC to trace).
//
// Tooltip/drilldown code still reads `series.values[i]` tuples, so each column also gets a lazy,
// row-aligned "tuple view": a Proxy over a real (sparse) array that materializes `[time, value]`
// tuples on first access and memoizes them. Panels the user never hovers stay columnar-only.

import { TimeScale, TimeSeries, TimeSeriesValueTuple } from '@perses-dev/spec';

/** Dimension name of the shared time column in the columnar dataset source. */
export const TIME_COLUMN_KEY = 'time';

/** Dimension name of a series' value column in the columnar dataset source. */
export const getSeriesColumnKey = (seriesIndex: number): string => `v${seriesIndex}`;

export interface ColumnarTimeChart {
  /** Column-object dataset source: shared time column + one value column per series. */
  source: Record<string, Float64Array>;
  /** The input series with `values` replaced by row-aligned lazy tuple views. */
  viewData: TimeSeries[];
}

function createTupleView(time: Float64Array, column: Float64Array): TimeSeriesValueTuple[] {
  const length = time.length;
  // The proxy target is a real array so Array.isArray(view) holds and array methods behave;
  // it doubles as the memoization cache for materialized tuples.
  const cache: Array<TimeSeriesValueTuple | undefined> = new Array(length);

  return new Proxy(cache, {
    get(target, prop, receiver): unknown {
      if (typeof prop === 'string') {
        const index = Number(prop);

        if (Number.isInteger(index) && index >= 0 && index < length) {
          let tuple = target[index];

          if (tuple === undefined) {
            const raw = column[index] as number;

            tuple = [time[index] as number, Number.isNaN(raw) ? null : raw];
            target[index] = tuple;
          }

          return tuple;
        }
      }

      return Reflect.get(target, prop, receiver);
    },
    // Array methods like map/forEach skip "holes" via HasProperty — every in-range row exists.
    has(target, prop): boolean {
      if (typeof prop === 'string') {
        const index = Number(prop);

        if (Number.isInteger(index) && index >= 0 && index < length) return true;
      }

      return Reflect.has(target, prop);
    },
  }) as TimeSeriesValueTuple[];
}

/**
 * Builds the columnar dataset source and row-aligned tuple views for a set of time series over a
 * common time scale. Rows cover every step of the time scale; series samples land on their row via
 * timestamp arithmetic and everything else stays NaN (a gap).
 */
export function buildColumnarTimeChart(data: TimeSeries[], timeScale: TimeScale): ColumnarTimeChart {
  const { startMs, endMs, stepMs } = timeScale;
  const rowCount = Math.max(1, Math.floor((endMs - startMs) / stepMs) + 1);

  const time = new Float64Array(rowCount);

  for (let row = 0; row < rowCount; row++) {
    time[row] = startMs + row * stepMs;
  }

  const source: Record<string, Float64Array> = { [TIME_COLUMN_KEY]: time };
  const viewData: TimeSeries[] = new Array(data.length);

  for (let seriesIndex = 0; seriesIndex < data.length; seriesIndex++) {
    const series = data[seriesIndex] as TimeSeries;
    const column = new Float64Array(rowCount).fill(NaN);

    for (const tuple of series.values ?? []) {
      const [timestamp, value] = tuple;

      if (value === null || value === undefined) continue;

      const row = Math.round((timestamp - startMs) / stepMs);

      if (row >= 0 && row < rowCount) {
        column[row] = value;
      }
    }

    source[getSeriesColumnKey(seriesIndex)] = column;
    viewData[seriesIndex] = { ...series, values: createTupleView(time, column) };
  }

  return { source, viewData };
}
// LOGZ.IO CHANGE END:: columnar chart data [unidash-perf]
