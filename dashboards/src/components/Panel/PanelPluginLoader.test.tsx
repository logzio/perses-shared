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
// The list handed to a panel plugin used to be built in the render body, so a panel that re-rendered
// for an unrelated reason gave its plugin a new array. Every plugin keys its data model on that
// array, so the model, the chart option and a full `setOption` all ran again for unchanged data.

import { ReactElement, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MockPlugin, PanelData, PanelProps, PluginRegistry, mockPluginRegistry } from '@perses-dev/plugin-system';
import { QueryDataType, UnknownSpec } from '@perses-dev/spec';
import { PanelPluginLoader } from './PanelPluginLoader';

const capturedQueryResults: Array<Array<PanelData<QueryDataType>>> = [];

function CapturingPanel(props: PanelProps<UnknownSpec, QueryDataType>): ReactElement {
  capturedQueryResults.push(props.queryResults);

  return <div>{`series: ${props.queryResults.length}`}</div>;
}

const CAPTURING_PLUGIN: MockPlugin = {
  kind: 'Panel',
  spec: { name: 'CapturingChart' },
  plugin: {
    PanelComponent: CapturingPanel,
    supportedQueryTypes: ['TimeSeriesQuery'],
    createInitialOptions: () => ({}),
  },
};

const QUERY_RESULTS: Array<PanelData<QueryDataType>> = [
  {
    definition: { kind: 'TimeSeriesQuery', spec: { plugin: { kind: 'PrometheusTimeSeriesQuery', spec: {} } } },
    data: { series: [] },
  },
];

function Host(): ReactElement {
  const [tick, setTick] = useState(0);

  return (
    <>
      <PanelPluginLoader kind="CapturingChart" spec={{}} queryResults={QUERY_RESULTS} />
      <button onClick={(): void => setTick(tick + 1)}>rerender</button>
    </>
  );
}

const renderLoader = (): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const registry = mockPluginRegistry(CAPTURING_PLUGIN);

  render(
    <QueryClientProvider client={queryClient}>
      <PluginRegistry pluginLoader={registry.pluginLoader} defaultPluginKinds={registry.defaultPluginKinds}>
        <Host />
      </PluginRegistry>
    </QueryClientProvider>
  );
};

describe('PanelPluginLoader', () => {
  it('should hand the panel plugin the same query results when the panel re-renders with unchanged data', async () => {
    renderLoader();
    expect(await screen.findByText('series: 1')).toBeInTheDocument();

    const beforeCount = capturedQueryResults.length;
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'rerender' }));
    });

    expect(capturedQueryResults.length).toBeGreaterThan(beforeCount);
    const first = capturedQueryResults[beforeCount - 1];
    capturedQueryResults.slice(beforeCount).forEach((results) => expect(results).toBe(first));
  });
});
