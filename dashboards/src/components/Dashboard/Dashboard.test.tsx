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

// LOGZ.IO CHANGE START:: Size a viewed panel by the dashboard's own box

import { screen } from '@testing-library/react';
import { TimeRangeProviderBasic } from '@perses-dev/plugin-system';
import { DashboardProvider, DatasourceStoreProvider, VariableProvider } from '../../context';
import { defaultDatasourceProps, getTestDashboard, renderWithContext } from '../../test';
import { Dashboard } from './Dashboard';

const DASHBOARD_BOX_HEIGHT = 537;
// What a viewed panel used to be sized against, which left it several times too tall.
const WINDOW_HEIGHT = 799;
const SCROLLED_BOX_TOP = -643;

jest.mock('use-resize-observer', () => ({
  __esModule: true,
  default: (): { ref: () => void; width: number; height: number } => ({
    ref: (): void => {},
    width: 1200,
    height: DASHBOARD_BOX_HEIGHT,
  }),
}));

const renderViewedPanel = (): void => {
  Object.defineProperty(window, 'innerHeight', { value: WINDOW_HEIGHT, configurable: true });
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  Element.prototype.getBoundingClientRect = (): DOMRect => ({ top: SCROLLED_BOX_TOP, height: 0 }) as DOMRect;

  const dashboard = getTestDashboard();

  renderWithContext(
    <DatasourceStoreProvider {...defaultDatasourceProps}>
      <TimeRangeProviderBasic initialRefreshInterval="0s" initialTimeRange={{ pastDuration: '30m' }}>
        <VariableProvider>
          <DashboardProvider initialState={{ dashboardResource: dashboard, viewPanelRef: { ref: 'cpu' } }}>
            <Dashboard />
          </DashboardProvider>
        </VariableProvider>
      </TimeRangeProviderBasic>
    </DatasourceStoreProvider>
  );
};

const getViewedPanelHeight = (): number => {
  const panel = screen.getByText('CPU').closest('.react-grid-item');
  if (!(panel instanceof HTMLElement)) throw new Error('Missing viewed panel');

  return Number.parseInt(panel.style.height, 10);
};

describe('Dashboard', () => {
  it('should keep a viewed panel within the dashboard box when the dashboard is scrolled', () => {
    renderViewedPanel();

    expect(getViewedPanelHeight()).toBeLessThanOrEqual(DASHBOARD_BOX_HEIGHT);
  });
});

// LOGZ.IO CHANGE END:: Size a viewed panel by the dashboard's own box
