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

// LOGZ.IO CHANGE FILE:: keep previous panel data across a refresh / time-range change.

import { UseQueryResult } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

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
 */
export function useRetainPreviousData<T>(results: Array<UseQueryResult<T>>): Array<UseQueryResult<T>> {
  const previousDataRef = useRef<Array<T | undefined>>([]);

  const merged = useMemo(() => {
    let changed = false;
    const next = results.map((result) => result);

    results.forEach((result, index) => {
      if (result.data !== undefined) return;

      const previousData = previousDataRef.current[index];
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
  }, [results]);

  useEffect(() => {
    results.forEach((result, index) => {
      if (result.data !== undefined) {
        previousDataRef.current[index] = result.data;
      }
    });
    // Drop retained data for positions that no longer exist (e.g. a query was removed).
    if (previousDataRef.current.length > results.length) {
      previousDataRef.current.length = results.length;
    }
  }, [results]);

  return merged;
}
