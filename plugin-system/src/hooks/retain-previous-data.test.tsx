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

describe('useRetainPreviousData', () => {
  test('retains the previous data while a query refetches with no data (refresh / time-range change)', () => {
    const { result, rerender } = renderHook(({ results }) => useRetainPreviousData(results), {
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
      useRetainPreviousData([asResult({ data: undefined, isFetching: true, isError: false })])
    );

    expect(result.current[0]?.data).toBeUndefined();
  });

  test('surfaces an error instead of showing stale data', () => {
    const { result, rerender } = renderHook(({ results }) => useRetainPreviousData(results), {
      initialProps: { results: [asResult({ data: 'D1', isFetching: false, isError: false })] },
    });

    rerender({ results: [asResult({ data: undefined, isFetching: false, isError: true })] });

    expect(result.current[0]?.data).toBeUndefined();
  });

  // End-to-end proof: this is exactly what the refresh flow does (key change), and it is the case
  // that `placeholderData: keepPreviousData` fails to cover for useQueries.
  test('retains data across a real useQueries key change', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result, rerender } = renderHook(
      ({ range }: { range: string }) => {
        const results = useQueries({
          queries: [{ queryKey: ['query', range], queryFn: async (): Promise<string> => `data-for-${range}` }],
        });
        return useRetainPreviousData(results as Array<UseQueryResult<string>>);
      },
      { initialProps: { range: 'r1' }, wrapper }
    );

    await waitFor(() => expect(result.current[0]?.data).toBe('data-for-r1'));

    rerender({ range: 'r2' });
    expect(result.current[0]?.data).toBe('data-for-r1');

    await waitFor(() => expect(result.current[0]?.data).toBe('data-for-r2'));
  });
});
