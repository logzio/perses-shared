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

// LOGZ.IO CHANGE START

import { ReactElement, ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { DashboardResource } from '@perses-dev/client';
import { useDashboard } from '../useDashboard';
import { DashboardProvider, useDashboardStore } from './DashboardProvider';

jest.mock('@perses-dev/plugin-system', () => ({
  ...jest.requireActual('@perses-dev/plugin-system'),
  usePluginRegistry: (): { defaultPluginKinds: Record<string, string> } => ({ defaultPluginKinds: {} }),
  usePlugin: (): { data: undefined } => ({ data: undefined }),
}));

// useDashboard reads variables and annotations from sibling providers; the settings round trip does not involve them.
const noop = (): void => {};

jest.mock('../VariableProvider', () => ({
  useVariableDefinitions: (): [] => [],
  useVariableDefinitionActions: (): { setVariableDefinitions: () => void } => ({ setVariableDefinitions: noop }),
}));
jest.mock('../AnnotationProvider', () => ({
  useAnnotationSpecs: (): [] => [],
  useAnnotationActions: (): { setAnnotationSpecs: () => void } => ({ setAnnotationSpecs: noop }),
}));

const buildResource = (settings?: Record<string, unknown>): DashboardResource => ({
  kind: 'Dashboard',
  metadata: { name: 'test-dashboard', project: 'test-project', version: 1 },
  spec: {
    duration: '1h',
    variables: [],
    layouts: [],
    panels: {},
    ...(settings === undefined ? {} : { settings }),
  },
});

interface DashboardHarness {
  dashboard: ReturnType<typeof useDashboard>;
  setSettings: (settings?: Record<string, unknown>) => void;
}

const renderDashboard = (resource: DashboardResource): ReturnType<typeof renderHook<DashboardHarness, unknown>> =>
  renderHook(
    (): DashboardHarness => ({
      dashboard: useDashboard(),
      setSettings: useDashboardStore((state) => state.setSettings),
    }),
    {
      wrapper: ({ children }: { children?: ReactNode }): ReactElement => (
        <DashboardProvider initialState={{ dashboardResource: resource }}>{children}</DashboardProvider>
      ),
    }
  );

describe('dashboard settings', () => {
  it('should expose settings from the initial spec', () => {
    const { result } = renderDashboard(buildResource({ seriesLimit: 250 }));

    expect(result.current.dashboard.dashboard.spec.settings).toEqual({ seriesLimit: 250 });
  });

  it('should leave settings undefined when the spec has none', () => {
    const { result } = renderDashboard(buildResource());

    expect(result.current.dashboard.dashboard.spec.settings).toBeUndefined();
  });

  it('should keep settings on the emitted spec after another part of the dashboard changes', () => {
    const { result } = renderDashboard(buildResource({ seriesLimit: 250 }));

    act(() => {
      result.current.dashboard.setDashboard({
        ...buildResource({ seriesLimit: 250 }),
        spec: { ...buildResource({ seriesLimit: 250 }).spec, duration: '6h' },
      });
    });

    expect(result.current.dashboard.dashboard.spec).toMatchObject({ duration: '6h', settings: { seriesLimit: 250 } });
  });

  it('should drop settings when a dashboard without them is applied from the JSON editor', () => {
    const { result } = renderDashboard(buildResource({ seriesLimit: 250 }));

    act(() => {
      result.current.dashboard.setDashboard(buildResource());
    });

    expect(result.current.dashboard.dashboard.spec.settings).toBeUndefined();
  });

  it('should expose a setter that writes settings onto the emitted spec', () => {
    const { result } = renderDashboard(buildResource());

    act(() => {
      result.current.setSettings({ seriesLimit: 250 });
    });

    expect(result.current.dashboard.dashboard.spec.settings).toEqual({ seriesLimit: 250 });
  });

  it('should remove settings from the emitted spec when the setter is called with undefined', () => {
    const { result } = renderDashboard(buildResource({ seriesLimit: 250 }));

    act(() => {
      result.current.setSettings(undefined);
    });

    expect(result.current.dashboard.dashboard.spec.settings).toBeUndefined();
  });

  it('should replace settings when the JSON editor applies a different value', () => {
    const { result } = renderDashboard(buildResource({ seriesLimit: 250 }));

    act(() => {
      result.current.dashboard.setDashboard(buildResource({ seriesLimit: 10 }));
    });

    expect(result.current.dashboard.dashboard.spec.settings).toEqual({ seriesLimit: 10 });
  });
});
