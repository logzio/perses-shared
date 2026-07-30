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

// LOGZ.IO FILE:: dependency gating must not consume retained data [stale-timeframe]
//
// `useTimeSeriesQueries` composes `useRetainPreviousData` (what the renderer sees) with
// `buildResolvedResults` (what gates and keys dependent `__expr__`/math queries). Those two must not
// be the same array: retained data is deliberately from a previous fetch, so feeding it to the
// dependency layer makes a math query compute over inputs it is no longer querying and emit a
// TimeSeriesData stamped with that older window. This pins the seam without standing up the whole
// plugin/datasource stack that `useTimeSeriesQueries` needs.

import { renderHook } from '@testing-library/react';
import { TimeSeriesData } from '@perses-dev/core';
import { UseQueryResult } from '@tanstack/react-query';
import { useRetainPreviousData } from '../hooks';
import { areDependenciesResolved, buildResolvedResults, getDependencyFingerprint } from './time-series-queries-utils';

const RANGE_A = 'rel:30m:now';

const DATA_FIRST_TICK: TimeSeriesData = { series: [], metadata: { executedQueryString: 'first' } };

const resolved = (data: TimeSeriesData): UseQueryResult<TimeSeriesData> =>
  ({ data, isFetching: false, isError: false }) as unknown as UseQueryResult<TimeSeriesData>;

const refetching = (): UseQueryResult<TimeSeriesData> =>
  ({ data: undefined, isFetching: true, isError: false }) as unknown as UseQueryResult<TimeSeriesData>;

// Query 1 is a math query over query 0.
const DEPENDENCIES = new Map<number, number[]>([
  [0, []],
  [1, [0]],
]);

describe('time series dependency gating', () => {
  test('reports a dependency as resolved once it has data', () => {
    const results = [resolved(DATA_FIRST_TICK), refetching()];

    expect(areDependenciesResolved(1, DEPENDENCIES, buildResolvedResults(results))).toBe(true);
  });

  test('does not report a dependency as resolved while it refetches, even though the renderer still shows its previous payload', () => {
    const { result, rerender } = renderHook(
      ({ results }: { results: Array<UseQueryResult<TimeSeriesData>> }) => ({
        retained: useRetainPreviousData(results, RANGE_A),
        resolvedResults: buildResolvedResults(results),
      }),
      { initialProps: { results: [resolved(DATA_FIRST_TICK), refetching()] } }
    );

    // A refresh tick: same selected range, new query keys, no data yet.
    rerender({ results: [refetching(), refetching()] });

    // The renderer keeps the previous payload so the panel does not flash a skeleton...
    expect(result.current.retained[0]?.data).toBe(DATA_FIRST_TICK);
    // ...but the dependency layer must not, so the math query waits instead of recomputing over it.
    expect(result.current.resolvedResults.has(0)).toBe(false);
    expect(areDependenciesResolved(1, DEPENDENCIES, result.current.resolvedResults)).toBe(false);
    expect(getDependencyFingerprint(result.current.resolvedResults, DEPENDENCIES, 1)).toEqual([undefined]);
  });

  test('re-enables the dependent query once the dependency produces data for the current fetch', () => {
    const dataSecondTick: TimeSeriesData = { series: [], metadata: { executedQueryString: 'second' } };

    const { result, rerender } = renderHook(
      ({ results }: { results: Array<UseQueryResult<TimeSeriesData>> }) => buildResolvedResults(results),
      { initialProps: { results: [refetching(), refetching()] } }
    );

    expect(areDependenciesResolved(1, DEPENDENCIES, result.current)).toBe(false);

    rerender({ results: [resolved(dataSecondTick), refetching()] });

    expect(areDependenciesResolved(1, DEPENDENCIES, result.current)).toBe(true);
    // The fingerprint is part of the math query's key, so it re-keys onto the fresh input.
    expect(getDependencyFingerprint(result.current, DEPENDENCIES, 1)).toEqual([dataSecondTick]);
  });
});
