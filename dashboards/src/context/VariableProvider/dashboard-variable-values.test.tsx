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

// LOGZ.IO CHANGE START:: Item-level repeat resolves against the dashboard, not the enclosing row [APPZ-0000]

import { ReactElement, ReactNode } from 'react';
import { screen } from '@testing-library/react';
import { TimeRangeProviderBasic, useVariableValues, VariableContext } from '@perses-dev/plugin-system';
import { VariableDefinition } from '@perses-dev/spec';
import { renderWithContext } from '../../test';
import { useDashboardVariableValues, VariableProvider } from './VariableProvider';

const definitions: VariableDefinition[] = [
  { kind: 'TextVariable', spec: { name: 'cluster', value: 'selected-on-dashboard' } },
];

/** Reports what each hook sees for `cluster`, so the two can be compared in one render. */
function Probe(): ReactElement {
  const scoped = useVariableValues();
  const dashboard = useDashboardVariableValues();

  return (
    <>
      <div>{`scoped: ${String(scoped['cluster']?.value)}`}</div>
      <div>{`dashboard: ${String(dashboard['cluster']?.value)}`}</div>
    </>
  );
}

const renderProbe = (children: ReactNode): void => {
  renderWithContext(
    <TimeRangeProviderBasic initialRefreshInterval="0s" initialTimeRange={{ pastDuration: '30m' }}>
      <VariableProvider initialVariableDefinitions={definitions}>{children}</VariableProvider>
    </TimeRangeProviderBasic>
  );
};

describe('useDashboardVariableValues', () => {
  it('should agree with useVariableValues when nothing is scoping the variable', () => {
    renderProbe(<Probe />);

    expect(screen.getByText('scoped: selected-on-dashboard')).toBeInTheDocument();
    expect(screen.getByText('dashboard: selected-on-dashboard')).toBeInTheDocument();
  });

  it('should ignore a repeat scope that pins the variable, which useVariableValues honors', () => {
    // This is what a repeated row installs around each of its copies. An item repeating over the
    // same variable has to look past it, or it only ever sees the one value its row was pinned to.
    renderProbe(
      <VariableContext.Provider value={{ state: { cluster: { value: 'pinned-by-row', loading: false } } }}>
        <Probe />
      </VariableContext.Provider>
    );

    expect(screen.getByText('scoped: pinned-by-row')).toBeInTheDocument();
    expect(screen.getByText('dashboard: selected-on-dashboard')).toBeInTheDocument();
  });
});

// LOGZ.IO CHANGE END:: Item-level repeat resolves against the dashboard [APPZ-0000]
