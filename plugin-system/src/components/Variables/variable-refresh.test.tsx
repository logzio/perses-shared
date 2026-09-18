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

// LOGZ.IO ADDITION:: whole file [unidash-perf]
// An auto-refresh tick used to give every list variable a new query key, because the key held the
// absolute range the declared one resolves to. A new key has no data, so the variable reported
// itself as loading on every tick — which re-renders every panel on the dashboard and disables
// every query that interpolates the variable, twice per tick.

import { ReactElement, ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, QueryKey } from '@tanstack/react-query';
import { ListVariableDefinition } from '@perses-dev/spec';
import { PluginRegistry } from '../PluginRegistry';
import { mockPluginRegistry } from '../../test-utils';
import { DatasourceStore, DatasourceStoreContext } from '../../runtime/datasources';
import { BuiltinVariableContext } from '../../runtime/builtin-variables';
import { VariableContext } from '../../runtime/variables';
import { TimeRangeProviderBasic } from '../../runtime/TimeRangeProvider';
import { useListVariablePluginValues } from './variable-model';

const REFRESH_INTERVAL_MS = 30_000;

const definition: ListVariableDefinition = {
  kind: 'ListVariable',
  spec: {
    name: 'cluster',
    allowMultiple: false,
    allowAllValue: false,
    plugin: { kind: 'StaticListVariable', spec: { values: ['test_value_1'] } },
  },
};

const getVariableOptions = jest.fn(async () => ({
  data: [{ value: 'test_value_1', label: 'Test label 1' }],
}));

const registry = mockPluginRegistry({
  kind: 'Variable',
  spec: { name: 'StaticListVariable' },
  plugin: { getVariableOptions, createInitialOptions: () => ({}) },
});

function Probe(): ReactElement {
  const query = useListVariablePluginValues(definition);

  return (
    <div>
      {`options: ${query.data?.length ?? 'none'} fetching: ${String(query.isFetching)} pending: ${String(
        query.isPending
      )}`}
    </div>
  );
}

const wrap = (children: ReactNode, queryClient: QueryClient): ReactElement => (
  <QueryClientProvider client={queryClient}>
    <PluginRegistry pluginLoader={registry.pluginLoader} defaultPluginKinds={registry.defaultPluginKinds}>
      <DatasourceStoreContext.Provider value={{} as DatasourceStore}>
        <BuiltinVariableContext.Provider value={{ variables: [] }}>
          <VariableContext.Provider value={{ state: {} }}>
            <TimeRangeProviderBasic initialTimeRange={{ pastDuration: '1h' }} initialRefreshInterval="30s">
              {children}
            </TimeRangeProviderBasic>
          </VariableContext.Provider>
        </BuiltinVariableContext.Provider>
      </DatasourceStoreContext.Provider>
    </PluginRegistry>
  </QueryClientProvider>
);

const variableKeys = (queryClient: QueryClient): QueryKey[] =>
  queryClient
    .getQueryCache()
    .getAll()
    .map((query) => query.queryKey)
    .filter((key) => key[0] === 'variable');

describe('useListVariablePluginValues', () => {
  it('should refresh its options on an auto-refresh tick without leaving the options it already has', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    getVariableOptions.mockClear();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(wrap(<Probe />, queryClient));

    await waitFor(() => expect(screen.getByText(/options: 1/)).toBeInTheDocument());
    const keysBeforeTick = variableKeys(queryClient);
    expect(keysBeforeTick).toHaveLength(1);

    await act(async () => {
      jest.advanceTimersByTime(REFRESH_INTERVAL_MS);
    });
    await waitFor(() => expect(getVariableOptions).toHaveBeenCalledTimes(2));

    // The tick refreshed the same query instead of starting a new one...
    expect(variableKeys(queryClient)).toEqual(keysBeforeTick);
    // ...so the variable kept its options throughout, and never reported itself as loading.
    expect(screen.getByText(/options: 1/)).toBeInTheDocument();
    expect(screen.queryByText(/options: none/)).not.toBeInTheDocument();

    jest.useRealTimers();
  });
});
