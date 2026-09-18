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

// LOGZ.IO ADDITION:: auto-refresh must re-key relative ranges rather than invalidate them [unidash-perf]

import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactElement } from 'react';
import { AbsoluteTimeRange, TimeRangeValue } from '@perses-dev/spec';
import { TimeRangeProvider, useTimeRange } from './TimeRangeProvider';

const REFRESH_INTERVAL_MS = 30_000;

function RangeReadout(): ReactElement {
  const { absoluteTimeRange } = useTimeRange();
  return <div data-testid="range">{`${absoluteTimeRange.start.valueOf()}-${absoluteTimeRange.end.valueOf()}`}</div>;
}

function renderProvider(timeRange: TimeRangeValue): { queryClient: QueryClient } {
  const queryClient = new QueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <TimeRangeProvider
        timeRange={timeRange}
        refreshInterval="30s"
        setTimeRange={jest.fn()}
        setRefreshInterval={jest.fn()}
      >
        <RangeReadout />
      </TimeRangeProvider>
    </QueryClientProvider>
  );

  return { queryClient };
}

describe('TimeRangeProvider auto refresh', () => {
  it('should advance a relative range without invalidating the panel queries it is about to re-key', () => {
    // Invalidating first refetched the outgoing keys, whose requests were then aborted once the
    // panels subscribed to the new range — over half of all requests on a 30s dashboard.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    try {
      const { queryClient } = renderProvider({ pastDuration: '1h' });
      const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');

      const before = screen.getByTestId('range').textContent;

      act(() => {
        jest.advanceTimersByTime(REFRESH_INTERVAL_MS);
      });

      expect(invalidateQueries).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['query'] }));
      expect(screen.getByTestId('range').textContent).not.toBe(before);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should refresh the variable options a relative range does not re-key', () => {
    // Variable options are keyed by the declared range so that a tick does not re-key them, which is
    // what used to make every variable report itself as loading twice a tick. Refreshing them is
    // therefore an invalidation of the key they already hold.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    try {
      const { queryClient } = renderProvider({ pastDuration: '1h' });
      const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');

      act(() => {
        jest.advanceTimersByTime(REFRESH_INTERVAL_MS);
      });

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['variable'] });
    } finally {
      jest.useRealTimers();
    }
  });

  it('should still invalidate when the range is absolute and cannot be re-keyed', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    try {
      const absolute: AbsoluteTimeRange = {
        start: new Date('2025-12-31T00:00:00.000Z'),
        end: new Date('2025-12-31T01:00:00.000Z'),
      };
      const { queryClient } = renderProvider(absolute);
      const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

      act(() => {
        jest.advanceTimersByTime(REFRESH_INTERVAL_MS);
      });

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['query'] });
    } finally {
      jest.useRealTimers();
    }
  });
});
