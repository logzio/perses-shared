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

// LOGZ.IO ADDITION:: the context value must survive a re-render of the provider with unchanged
// inputs — otherwise every panel body re-renders whenever the grid does [unidash-perf]

import React, { ReactElement, useState } from 'react';
import { act, render } from '@testing-library/react';
import { QueryDefinition } from '@perses-dev/spec';
import { DataQueriesProvider, useDataQueriesContext } from './DataQueriesProvider';

// Stable arrays: with fresh results on every call the provider could not be stable no matter what.
const TIME_SERIES_RESULTS = [
  { data: { series: [] }, isLoading: false, isFetching: false, error: null, refetch: jest.fn() },
];
const EMPTY: never[] = [];

jest.mock('../time-series-queries', () => ({ useTimeSeriesQueries: (): unknown[] => TIME_SERIES_RESULTS }));
jest.mock('../trace-queries', () => ({ useTraceQueries: (): unknown[] => EMPTY }));
jest.mock('../profile-queries', () => ({ useProfileQueries: (): unknown[] => EMPTY }));
jest.mock('../log-queries', () => ({ useLogQueries: (): unknown[] => EMPTY }));
jest.mock('../alerts-queries', () => ({ useAlertsQueries: (): unknown[] => EMPTY }));
jest.mock('../silences-queries', () => ({ useSilencesQueries: (): unknown[] => EMPTY }));
jest.mock('../plugin-registry', () => ({
  useListPluginMetadata: (): { data: never[]; isLoading: boolean } => ({ data: [], isLoading: false }),
}));
// useUsageMetrics is deliberately NOT mocked: its result object sits in the provider's memo deps.

const DEFINITIONS: QueryDefinition[] = [
  { kind: 'TimeSeriesQuery', spec: { plugin: { kind: 'PrometheusTimeSeriesQuery', spec: { query: 'up' } } } },
];
const OPTIONS = { suggestedStepMs: 15_000 };
const QUERY_OPTIONS = { enabled: true };

const seen: unknown[] = [];
function Consumer(): ReactElement {
  seen.push(useDataQueriesContext());
  return <div />;
}

let bump: () => void = () => {};
function Host(): ReactElement {
  const [, setTick] = useState(0);
  bump = (): void => setTick((t) => t + 1);
  return (
    <DataQueriesProvider definitions={DEFINITIONS} options={OPTIONS} queryOptions={QUERY_OPTIONS}>
      <Consumer />
    </DataQueriesProvider>
  );
}

describe('DataQueriesProvider context stability', () => {
  test('should hand consumers the same context object when the provider re-renders with unchanged inputs', () => {
    render(<Host />);
    const first = seen[seen.length - 1];

    act(() => bump());
    act(() => bump());

    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(seen[seen.length - 1]).toBe(first);
  });
});
