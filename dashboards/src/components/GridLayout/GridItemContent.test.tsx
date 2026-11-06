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

// LOGZ.IO CHANGE START:: A viewed panel keeps the query width it had in the grid

import { DashboardResource } from '@perses-dev/client';
import {
  MockPlugin,
  mockPluginRegistry,
  PluginRegistry,
  TimeRangeProviderBasic,
  TimeSeriesQueryPlugin,
} from '@perses-dev/plugin-system';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardProvider, DatasourceStoreProvider, VariableProvider } from '../../context';
import { defaultDatasourceProps, MOCK_PLUGINS, renderWithContext } from '../../test';
import { Dashboard } from '../Dashboard';

jest.mock('use-resize-observer', () => ({
  __esModule: true,
  default: (): { ref: () => void; width: number; height: number } => ({
    ref: (): void => {},
    width: 1200,
    height: 600,
  }),
}));

const PANEL_TITLE = 'Test panel 1';
const VIEW_PANEL_LABEL = `toggle panel ${PANEL_TITLE} view mode`;
const FAKE_QUERY_KIND = 'FakeTimeSeriesQuery';

const DASHBOARD: DashboardResource = {
  kind: 'Dashboard',
  metadata: { name: 'test_dashboard_1', project: 'test_project_1' },
  spec: {
    duration: '30m',
    refreshInterval: '0s',
    variables: [],
    panels: {
      test_panel_1: {
        kind: 'Panel',
        spec: {
          display: { name: PANEL_TITLE },
          plugin: { kind: 'TimeSeriesChart', spec: {} },
          queries: [{ kind: 'TimeSeriesQuery', spec: { plugin: { kind: FAKE_QUERY_KIND, spec: {} } } }],
        },
      },
    },
    layouts: [
      {
        kind: 'Grid',
        spec: {
          items: [{ x: 0, y: 0, width: 12, height: 6, content: { $ref: '#/spec/panels/test_panel_1' } }],
        },
      },
    ],
  },
};

const renderDashboard = (getTimeSeriesData: TimeSeriesQueryPlugin['getTimeSeriesData']): void => {
  const fakeQuery: MockPlugin = {
    kind: 'TimeSeriesQuery',
    spec: { name: FAKE_QUERY_KIND },
    plugin: { getTimeSeriesData, createInitialOptions: () => ({}) },
  };
  const registry = mockPluginRegistry(...MOCK_PLUGINS, fakeQuery);
  // app-ui removes a query without observers after one minute. `gcTime: 0` does the same at once, so a
  // panel that comes back to a removed key queries again.
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });

  renderWithContext(
    <QueryClientProvider client={queryClient}>
      <PluginRegistry pluginLoader={registry.pluginLoader} defaultPluginKinds={registry.defaultPluginKinds}>
        <DatasourceStoreProvider {...defaultDatasourceProps}>
          <TimeRangeProviderBasic initialRefreshInterval="0s" initialTimeRange={{ pastDuration: '30m' }}>
            <VariableProvider>
              <DashboardProvider initialState={{ dashboardResource: DASHBOARD }}>
                <Dashboard />
              </DashboardProvider>
            </VariableProvider>
          </TimeRangeProviderBasic>
        </DatasourceStoreProvider>
      </PluginRegistry>
    </QueryClientProvider>
  );
};

/** Gives a query with a new key the time to reach its plugin, before the test reads the call count. */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
};

const toggleViewMode = async (): Promise<void> => {
  const [viewButton] = screen.getAllByRole('button', { name: VIEW_PANEL_LABEL });
  if (!viewButton) throw new Error('Missing view button');

  userEvent.click(viewButton);
  await settle();
};

describe('GridItemContent', () => {
  it('should not query again when a panel opens in view mode and closes again', async () => {
    const getTimeSeriesData = jest.fn().mockResolvedValue({ series: [] });

    renderDashboard(getTimeSeriesData);
    await waitFor(() => expect(getTimeSeriesData).toHaveBeenCalledTimes(1));

    await toggleViewMode();
    await toggleViewMode();

    expect(getTimeSeriesData).toHaveBeenCalledTimes(1);
  });
});

// LOGZ.IO CHANGE END:: A viewed panel keeps the query width it had in the grid
