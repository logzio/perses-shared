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

// LOGZ.IO ADDITION:: the query context object feeds the `context`, `dependencies` and `queries`
// memos. A fresh object per render makes every panel rebuild its query configs and re-hash its query
// keys (app-ui's queryKeyHashFn stringifies the whole query definition) on every render. [unidash-perf]

import { ReactElement, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import { TimeSeriesQueryDefinition } from '@perses-dev/spec';
import { useTimeSeriesQueries } from './time-series-queries';

const TIME_RANGE = { start: new Date(1_700_000_000_000), end: new Date(1_700_003_600_000) };
const VARIABLE_STATE = { test_variable_1: { value: 'test_value_1', loading: false } };
const DATASOURCE_STORE = {
  getDatasource: jest.fn(),
  getDatasourceClient: jest.fn(),
  listDatasourceSelectItems: jest.fn(),
};
const PLUGIN_RESPONSE = [{ data: undefined, isLoading: false }];
const PLUGIN_REGISTRY = { getPlugin: jest.fn() };
const PLUGIN = { data: undefined };
const NO_RESULTS: unknown[] = [];

// Everything the hook reads from context is stable here on purpose: the object it builds from them
// is the thing under test.
jest.mock('./TimeRangeProvider', () => ({
  useTimeRange: (): unknown => ({ absoluteTimeRange: TIME_RANGE, rangeKey: 'test_range_1', refreshIntervalInMs: 0 }),
}));
jest.mock('./variables', () => ({ useAllVariableValues: (): unknown => VARIABLE_STATE }));
jest.mock('./datasources', () => ({ useDatasourceStore: (): unknown => DATASOURCE_STORE }));
jest.mock('./plugin-registry', () => ({
  usePlugin: (): unknown => PLUGIN,
  usePluginRegistry: (): unknown => PLUGIN_REGISTRY,
  usePlugins: (): unknown => PLUGIN_RESPONSE,
}));

// Capture what the query layer is handed, and keep the results stable so nothing else can churn.
const capturedQueries: unknown[][] = [];
jest.mock('../hooks', () => ({
  useStableQueries: ({ queries }: { queries: unknown[] }): unknown[] => {
    capturedQueries.push(queries);

    return NO_RESULTS;
  },
  useRetainPreviousData: (results: unknown[]): unknown[] => results,
}));

const DEFINITIONS: TimeSeriesQueryDefinition[] = [
  {
    kind: 'TimeSeriesQuery',
    spec: { plugin: { kind: 'PrometheusTimeSeriesQuery', spec: { query: 'up{cluster="$test_variable_1"}' } } },
  },
];
const OPTIONS = { suggestedStepMs: 15_000 };
const QUERY_OPTIONS = { enabled: true };

function Host(): ReactElement {
  const [tick, setTick] = useState(0);
  useTimeSeriesQueries(DEFINITIONS, OPTIONS, QUERY_OPTIONS);

  return <button onClick={(): void => setTick(tick + 1)}>rerender</button>;
}

describe('useTimeSeriesQueries query context', () => {
  it('should not rebuild the query configs when re-rendering with unchanged inputs', () => {
    render(<Host />);
    const first = capturedQueries[capturedQueries.length - 1];

    act(() => {
      screen.getByRole('button', { name: 'rerender' }).click();
    });
    act(() => {
      screen.getByRole('button', { name: 'rerender' }).click();
    });

    expect(capturedQueries.length).toBeGreaterThanOrEqual(3);
    expect(capturedQueries[capturedQueries.length - 1]).toBe(first);
  });
});
