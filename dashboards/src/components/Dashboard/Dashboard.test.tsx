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

import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeRangeProviderBasic } from '@perses-dev/plugin-system';
import { DashboardProvider, DashboardStoreState, DatasourceStoreProvider, VariableProvider } from '../../context';
import { defaultDatasourceProps, getTestDashboard, renderWithContext } from '../../test';
import { Dashboard } from './Dashboard';

const DASHBOARD_BOX_HEIGHT = 537;
const WINDOW_HEIGHT = 799;
const SCROLLED_BOX_TOP = -643;

let mockObservedHeight = DASHBOARD_BOX_HEIGHT;

jest.mock('use-resize-observer', () => ({
  __esModule: true,
  default: (): { ref: () => void; width: number; height: number } => ({
    ref: (): void => {},
    width: 1200,
    height: mockObservedHeight,
  }),
}));

const renderViewedPanel = ({ observedHeight = DASHBOARD_BOX_HEIGHT }: { observedHeight?: number } = {}): void => {
  mockObservedHeight = observedHeight;
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

const renderAndViewCollapsedPanel = async (): Promise<{ current: DashboardStoreState | null }> => {
  const storeRef: { current: DashboardStoreState | null } = { current: null };

  renderWithContext(
    <DatasourceStoreProvider {...defaultDatasourceProps}>
      <TimeRangeProviderBasic initialRefreshInterval="0s" initialTimeRange={{ pastDuration: '30m' }}>
        <VariableProvider>
          <DashboardProvider dashboardStoreApiRef={storeRef} initialState={{ dashboardResource: getTestDashboard() }}>
            <Dashboard />
          </DashboardProvider>
        </VariableProvider>
      </TimeRangeProviderBasic>
    </DatasourceStoreProvider>
  );

  await userEvent.click(screen.getByRole('button', { name: 'expand group Disk Stats' }));
  await userEvent.click(screen.getByRole('button', { name: 'toggle panel Filesystem Fullness view mode' }));

  return storeRef;
};

describe('Dashboard', () => {
  it('should keep a viewed panel within the dashboard box when the dashboard is scrolled', () => {
    renderViewedPanel();

    expect(getViewedPanelHeight()).toBeLessThanOrEqual(DASHBOARD_BOX_HEIGHT);
  });

  it('should keep a viewed panel within the window when the host leaves the dashboard box content-sized', () => {
    renderViewedPanel({ observedHeight: 1880 });

    expect(getViewedPanelHeight()).toBeLessThanOrEqual(WINDOW_HEIGHT);
  });

  it('should show only the viewed panel when the dashboard is reset after the panel was opened from its action', async () => {
    const storeRef = await renderAndViewCollapsedPanel();

    // Save, discard and a JSON edit also reset the variables first; this checks only the layout reset
    act(() => storeRef.current?.setDashboard(getTestDashboard()));

    expect(screen.getByText('Filesystem Fullness')).toBeVisible();
    expect(screen.getByText('CPU')).not.toBeVisible();
  });

  it('should show all panels again when view mode is turned off after the dashboard is reset', async () => {
    const storeRef = await renderAndViewCollapsedPanel();
    act(() => storeRef.current?.setDashboard(getTestDashboard()));

    await userEvent.click(screen.getByRole('button', { name: 'toggle panel Filesystem Fullness view mode' }));

    expect(screen.getByText('CPU')).toBeVisible();
  });

  it('should open the collapsed group of a viewed panel without an expand animation when the dashboard is reset', async () => {
    const storeRef = await renderAndViewCollapsedPanel();

    act(() => storeRef.current?.setDashboard(getTestDashboard()));

    const groupContent = screen.getByText('Filesystem Fullness').closest('.MuiCollapse-root');
    expect(groupContent?.classList.contains('MuiCollapse-entered')).toBe(true);
  });
});

// LOGZ.IO CHANGE END:: Size a viewed panel by the dashboard's own box
