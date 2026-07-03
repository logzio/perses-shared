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

// LOGZ.IO ADDITION:: guards the O(1) row-aligned datum lookup in the nearby-series candidate pass —
// aligned series resolve by row index, unaligned series fall back to a scan [unidash-perf]

import { ECharts as EChartsInstance } from 'echarts/core';
import { TimeSeries } from '@perses-dev/core';
import { TimeChartSeriesMapping } from '../model';
import { gatherCandidates } from './utils';

const TIMESTAMPS = [1_000, 1_015, 1_030, 1_045, 1_060];

function buildAlignedSeries(name: string, offset: number): TimeSeries {
  return { name, values: TIMESTAMPS.map((ts, i) => [ts, offset + i]) };
}

function buildSeriesMapping(count: number): TimeChartSeriesMapping {
  return Array.from({ length: count }, (_, i) => ({
    type: 'line' as const,
    id: `s${i}`,
    name: `s${i}`,
    color: '#000',
  }));
}

// The line-series path only touches the chart when a pixel-space cursor is provided; these tests
// use data-space distances so a bare object is enough.
const CHART = {} as unknown as EChartsInstance;

describe('gatherCandidates', () => {
  it('should resolve every aligned series through the shared row index at the last timestamp', () => {
    const data = [buildAlignedSeries('a', 0), buildAlignedSeries('b', 10), buildAlignedSeries('c', 20)];

    const candidates = gatherCandidates({
      data,
      seriesMapping: buildSeriesMapping(3),
      closestTimestamp: 1_060,
      cursorY: 15,
      yBuffer: 30,
      chart: CHART,
    });

    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.datumIdx)).toEqual([4, 4, 4]);
    expect(candidates.map((c) => c.y)).toEqual([4, 14, 24]);
    expect(candidates.every((c) => c.date === 1_060)).toBe(true);
  });

  it('should fall back to a scan for series that are not row-aligned with the first series', () => {
    const misaligned: TimeSeries = { name: 'short', values: [[1_060, 42]] };
    const data = [buildAlignedSeries('a', 0), misaligned];

    const candidates = gatherCandidates({
      data,
      seriesMapping: buildSeriesMapping(2),
      closestTimestamp: 1_060,
      cursorY: 20,
      yBuffer: 50,
      chart: CHART,
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[1]?.datumIdx).toBe(0);
    expect(candidates[1]?.y).toBe(42);
  });

  it('should skip series whose value at the shared row is null', () => {
    const gappy: TimeSeries = { name: 'gappy', values: TIMESTAMPS.map((ts, i) => [ts, i === 4 ? null : i]) };
    const data = [buildAlignedSeries('a', 0), gappy];

    const candidates = gatherCandidates({
      data,
      seriesMapping: buildSeriesMapping(2),
      closestTimestamp: 1_060,
      cursorY: 4,
      yBuffer: 10,
      chart: CHART,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.seriesIdx).toBe(0);
  });
});
