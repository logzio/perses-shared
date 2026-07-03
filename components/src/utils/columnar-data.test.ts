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

// LOGZ.IO ADDITION:: tests for the columnar chart data + lazy tuple views [unidash-perf]

import { TimeScale, TimeSeries } from '@perses-dev/spec';
import { buildColumnarTimeChart, getSeriesColumnKey, TIME_COLUMN_KEY } from './columnar-data';

const TIME_SCALE: TimeScale = { startMs: 1_000, endMs: 1_060, stepMs: 15, rangeMs: 60 }; // 5 rows

const SERIES: TimeSeries[] = [
  {
    name: 'full',
    values: [
      [1_000, 1],
      [1_015, 2],
      [1_030, 3],
      [1_045, 4],
      [1_060, 5],
    ],
  },
  {
    name: 'gappy',
    values: [
      [1_015, 20],
      [1_060, 60],
    ],
  },
];

describe('buildColumnarTimeChart', () => {
  it('should build a shared time column and one NaN-gapped value column per series', () => {
    const { source } = buildColumnarTimeChart(SERIES, TIME_SCALE);

    expect(Array.from(source[TIME_COLUMN_KEY] ?? [])).toEqual([1_000, 1_015, 1_030, 1_045, 1_060]);
    expect(Array.from(source[getSeriesColumnKey(0)] ?? [])).toEqual([1, 2, 3, 4, 5]);

    const gappy = Array.from(source[getSeriesColumnKey(1)] ?? []);

    expect(gappy[1]).toBe(20);
    expect(gappy[4]).toBe(60);
    expect(gappy.filter(Number.isNaN)).toHaveLength(3);
  });

  it('should ignore samples outside the time scale and null values', () => {
    const { source } = buildColumnarTimeChart(
      [{ name: 's', values: [[900, 1], [1_030, null], [1_045, 7], [2_000, 9]] }],
      TIME_SCALE,
    );
    const column = Array.from(source[getSeriesColumnKey(0)] ?? []);

    expect(column[3]).toBe(7);
    expect(column.filter(Number.isNaN)).toHaveLength(4);
  });

  it('should expose row-aligned tuple views that read like the old tuple arrays', () => {
    const { viewData } = buildColumnarTimeChart(SERIES, TIME_SCALE);
    const gappy = viewData[1]?.values ?? [];

    expect(Array.isArray(gappy)).toBe(true);
    expect(gappy).toHaveLength(5);
    expect(gappy[1]).toEqual([1_015, 20]);
    expect(gappy[2]).toEqual([1_030, null]); // gap row reads as a null tuple
    expect(viewData[1]?.name).toBe('gappy');
  });

  it('should support iteration, find and map like a plain tuple array', () => {
    const { viewData } = buildColumnarTimeChart(SERIES, TIME_SCALE);
    const values = viewData[0]?.values ?? [];

    // for-of (getClosestTimestamp's access pattern)
    const timestamps: number[] = [];

    for (const [timestamp] of values) timestamps.push(timestamp);
    expect(timestamps).toEqual([1_000, 1_015, 1_030, 1_045, 1_060]);

    // find (gatherCandidates' access pattern)
    expect(values.find(([ts]) => ts === 1_030)).toEqual([1_030, 3]);

    // map visits every row (no holes)
    expect(values.map(([, v]) => v)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should memoize materialized tuples so repeated reads return the same object', () => {
    const { viewData } = buildColumnarTimeChart(SERIES, TIME_SCALE);
    const values = viewData[0]?.values ?? [];

    expect(values[0]).toBe(values[0]);
  });

  it('should produce at least one row when the range is smaller than a step', () => {
    const { source } = buildColumnarTimeChart(SERIES, { startMs: 1_000, endMs: 1_005, stepMs: 15, rangeMs: 5 });

    expect(source[TIME_COLUMN_KEY]).toHaveLength(1);
  });
});
