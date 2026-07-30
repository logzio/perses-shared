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

// LOGZ.IO CHANGE FILE:: keep previous panel data across a refresh, but never across a time-range
// change. [stale-timeframe]

import { UseQueryResult } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

interface RetainedData<T> {
  key: string;
  data: Array<T | undefined>;
}

/**
 * On a refresh (manual or automatic) with a relative time range, the resolved absolute time range
 * changes, which changes each query's key. React Query then treats it as a brand-new query whose
 * `data` is `undefined` until the fetch resolves, so panels fall back to the full loading skeleton.
 *
 * `placeholderData: keepPreviousData` solves this for `useQuery`, but NOT for `useQueries`: its
 * `QueriesObserver` recreates the per-query observer when the key changes, so there is no previous
 * data to keep. All panel data flows through `useQueries`, so we retain the previous data manually:
 * while a query has no data (and no error), reuse the last data it produced. New panels and the
 * initial dashboard load have no previous data, so they still show the skeleton as expected.
 *
 * Retention is keyed by position; the query definitions are stable across a refresh, so positions
 * are stable. The previous data is only stored from committed renders (via effect) to stay correct
 * under concurrent rendering.
 *
 * `retentionKey` scopes the retained data to the window it was fetched for — pass the time range's
 * `rangeKey`. Retaining across a *refresh* is the point of this hook; retaining across a
 * *time-range change* is a correctness bug, because a chart's x-axis is derived from the payload
 * (`TimeSeriesData.timeRange`), not from the time-range context. Without this scoping a panel whose
 * new query has not produced data — e.g. it is `enabled: false` while a template variable it
 * depends on refetches — keeps rendering the previous window's response indefinitely, reporting
 * `isLoading: false` and showing no spinner, so the user sees a confidently wrong chart instead of
 * a loading state.
 */
export function useRetainPreviousData<T>(
  results: Array<UseQueryResult<T>>,
  retentionKey: string
): Array<UseQueryResult<T>> {
  const retainedRef = useRef<RetainedData<T>>({ key: retentionKey, data: [] });

  // Compared during render against the last *committed* key. A discarded render therefore fails
  // toward "do not substitute", which is the safe direction.
  const isRetainable = retainedRef.current.key === retentionKey;

  const merged = useMemo(() => {
    if (!isRetainable) return results;

    let changed = false;
    const next = [...results];

    results.forEach((result, index) => {
      if (result.data !== undefined) return;

      const previousData = retainedRef.current.data[index];
      if (previousData !== undefined && !result.isError) {
        next[index] = {
          ...result,
          data: previousData,
          isLoading: false,
          isPlaceholderData: true,
        } as UseQueryResult<T>;
        changed = true;
      }
    });

    return changed ? next : results;
  }, [results, isRetainable]);

  useEffect(() => {
    const retained = retainedRef.current;

    // The selected window changed: everything retained belongs to the previous one.
    if (retained.key !== retentionKey) {
      retained.key = retentionKey;
      retained.data = [];
    }

    results.forEach((result, index) => {
      if (result.data !== undefined) {
        retained.data[index] = result.data;
      }
    });
    // Drop retained data for positions that no longer exist (e.g. a query was removed).
    if (retained.data.length > results.length) {
      retained.data.length = results.length;
    }
  }, [results, retentionKey]);

  return merged;
}
