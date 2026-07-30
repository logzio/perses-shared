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

import { ReactElement, ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQueries, UseQueryResult } from '@tanstack/react-query';
import { useRetainPreviousData } from './retain-previous-data';

const asResult = (partial: Partial<UseQueryResult<string>>): UseQueryResult<string> =>
  partial as unknown as UseQueryResult<string>;

// The selected window. A refresh re-resolves the absolute range (so query keys change) while this
// stays put; picking a different range in the time picker changes it.
const RANGE_A = 'rel:30m:now';
const RANGE_B = 'abs:1000:2000';

describe('useRetainPreviousData', () => {
  test('retains the previous data while a query refetches with no data (refresh)', () => {
    const { result, rerender } = renderHook(({ results }) => useRetainPreviousData(results, RANGE_A), {
      initialProps: { results: [asResult({ data: 'D1', isFetching: false, isError: false })] },
    });

    expect(result.current[0]?.data).toBe('D1');

    // Refresh: the key changes, so the new query has no data yet while it fetches.
    rerender({ results: [asResult({ data: undefined, isFetching: true, isError: false })] });

    expect(result.current[0]?.data).toBe('D1');
    expect(result.current[0]?.isPlaceholderData).toBe(true);

    // New data arrives.
    rerender({ results: [asResult({ data: 'D2', isFetching: false, isError: false })] });

    expect(result.current[0]?.data).toBe('D2');
  });

  test('does not backfill on the initial load when there is no previous data', () => {
    const { result } = renderHook(() =>
      useRetainPreviousData([asResult({ data: undefined, isFetching: true, isError: false })], RANGE_A)
    );

    expect(result.current[0]?.data).toBeUndefined();
  });

  test('surfaces an error instead of showing stale data', () => {
    const { result, rerender } = renderHook(({ results }) => useRetainPreviousData(results, RANGE_A), {
      initialProps: { results: [asResult({ data: 'D1', isFetching: false, isError: false })] },
    });

    rerender({ results: [asResult({ data: undefined, isFetching: false, isError: true })] });

    expect(result.current[0]?.data).toBeUndefined();
  });

  // Regression: a panel's x-axis is derived from the payload, so retaining data across a time-range
  // change renders a chart for a window the panel is no longer querying — with no spinner and
  // `isLoading: false`, indefinitely, whenever the new query has not produced data (e.g. it is
  // `enabled: false` while a template variable it depends on refetches).
  test('drops the retained data when the selected time range changes', () => {
    const { result, rerender } = renderHook(({ results, rangeKey }) => useRetainPreviousData(results, rangeKey), {
      initialProps: {
        results: [asResult({ data: 'data-for-A', isFetching: false, isError: false })],
        rangeKey: RANGE_A,
      },
    });

    expect(result.current[0]?.data).toBe('data-for-A');

    // User picks a different range; the new query has not resolved yet.
    rerender({
      results: [asResult({ data: undefined, isFetching: true, isError: false })],
      rangeKey: RANGE_B,
    });

    expect(result.current[0]?.data).toBeUndefined();
    expect(result.current[0]?.isPlaceholderData).toBeUndefined();
    expect(result.current[0]?.isLoading).toBeUndefined();
  });

  test('does not resurrect the previous range data on later renders of the new range', () => {
    const { result, rerender } = renderHook(({ results, rangeKey }) => useRetainPreviousData(results, rangeKey), {
      initialProps: {
        results: [asResult({ data: 'data-for-A', isFetching: false, isError: false })],
        rangeKey: RANGE_A,
      },
    });

    rerender({
      results: [asResult({ data: undefined, isFetching: true, isError: false })],
      rangeKey: RANGE_B,
    });
    // A second render under the new range (e.g. a variable settling) must not reintroduce A's data.
    rerender({
      results: [asResult({ data: undefined, isFetching: false, isError: false })],
      rangeKey: RANGE_B,
    });

    expect(result.current[0]?.data).toBeUndefined();
  });

  test('retains again once the new range has produced data', () => {
    const { result, rerender } = renderHook(({ results, rangeKey }) => useRetainPreviousData(results, rangeKey), {
      initialProps: {
        results: [asResult({ data: 'data-for-A', isFetching: false, isError: false })],
        rangeKey: RANGE_A,
      },
    });

    rerender({
      results: [asResult({ data: 'data-for-B', isFetching: false, isError: false })],
      rangeKey: RANGE_B,
    });
    // Refresh within range B: retention is back in play, and it serves B's data — never A's.
    rerender({
      results: [asResult({ data: undefined, isFetching: true, isError: false })],
      rangeKey: RANGE_B,
    });

    expect(result.current[0]?.data).toBe('data-for-B');
  });

  // End-to-end proof: this is exactly what the refresh flow does (key change), and it is the case
  // that `placeholderData: keepPreviousData` fails to cover for useQueries.
  test('retains data across a real useQueries key change within the same range', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result, rerender } = renderHook(
      ({ resolvedAt }: { resolvedAt: string }) => {
        const results = useQueries({
          queries: [
            { queryKey: ['query', resolvedAt], queryFn: async (): Promise<string> => `data-for-${resolvedAt}` },
          ],
        });
        return useRetainPreviousData(results as Array<UseQueryResult<string>>, RANGE_A);
      },
      { initialProps: { resolvedAt: 't1' }, wrapper }
    );

    await waitFor(() => expect(result.current[0]?.data).toBe('data-for-t1'));

    rerender({ resolvedAt: 't2' });
    expect(result.current[0]?.data).toBe('data-for-t1');

    await waitFor(() => expect(result.current[0]?.data).toBe('data-for-t2'));
  });

  test('never shows the previous range across a real useQueries range change', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const seen: Array<string | undefined> = [];

    const { result, rerender } = renderHook(
      ({ rangeKey }: { rangeKey: string }) => {
        const results = useQueries({
          queries: [{ queryKey: ['query', rangeKey], queryFn: async (): Promise<string> => `data-for-${rangeKey}` }],
        });
        const retained = useRetainPreviousData(results as Array<UseQueryResult<string>>, rangeKey);
        seen.push(retained[0]?.data);
        return retained;
      },
      { initialProps: { rangeKey: RANGE_A }, wrapper }
    );

    await waitFor(() => expect(result.current[0]?.data).toBe(`data-for-${RANGE_A}`));

    rerender({ rangeKey: RANGE_B });
    await waitFor(() => expect(result.current[0]?.data).toBe(`data-for-${RANGE_B}`));

    // Nothing rendered A's payload after the switch: the boundary is the first B-keyed render.
    const firstBRender = seen.indexOf(undefined, seen.indexOf(`data-for-${RANGE_A}`));
    expect(firstBRender).toBeGreaterThan(-1);
    expect(seen.slice(firstBRender)).not.toContain(`data-for-${RANGE_A}`);
  });
});
