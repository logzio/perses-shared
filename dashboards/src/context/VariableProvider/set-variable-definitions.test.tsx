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

// LOGZ.IO CHANGE:: whole file
// A list variable writes its options only when its options query returns new data. When the
// definitions are set again with the same plugin, that query returns its cached data, so the
// options must survive the reset or "All" expands to nothing.

import { ReactElement } from 'react';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeRangeProviderBasic, VariableOption } from '@perses-dev/plugin-system';
import { DEFAULT_ALL_VALUE, ListVariableDefinition, VariableDefinition } from '@perses-dev/spec';
import { renderWithContext } from '../../test';
import { useDashboardVariableValues, useVariableDefinitionActions, VariableProvider } from './VariableProvider';

const LOADED_OPTIONS: VariableOption[] = [
  { value: 'test_value_1', label: 'Test label 1' },
  { value: 'test_value_2', label: 'Test label 2' },
];

const createDefinition = ({
  values = ['test_value_1', 'test_value_2'],
  displayName = 'Test label 1',
}: { values?: string[]; displayName?: string } = {}): ListVariableDefinition => ({
  kind: 'ListVariable',
  spec: {
    name: 'test_variable_1',
    display: { name: displayName },
    allowAllValue: true,
    allowMultiple: true,
    defaultValue: DEFAULT_ALL_VALUE,
    plugin: { kind: 'StaticListVariable', spec: { values } },
  },
});

function Consumer(): ReactElement {
  const values = useDashboardVariableValues();

  return <div>{`expanded: ${JSON.stringify(values['test_variable_1']?.value)}`}</div>;
}

function Actions({ nextDefinitions }: { nextDefinitions: VariableDefinition[] }): ReactElement {
  const { setVariableOptions, setVariableDefinitions } = useVariableDefinitionActions();

  return (
    <>
      <button onClick={(): void => setVariableOptions('test_variable_1', LOADED_OPTIONS)}>load options</button>
      <button onClick={(): void => setVariableDefinitions(nextDefinitions)}>set definitions</button>
    </>
  );
}

const renderAndReset = async (nextDefinitions: VariableDefinition[]): Promise<void> => {
  renderWithContext(
    <TimeRangeProviderBasic initialRefreshInterval="0s" initialTimeRange={{ pastDuration: '30m' }}>
      <VariableProvider initialVariableDefinitions={[createDefinition()]}>
        <Consumer />
        <Actions nextDefinitions={nextDefinitions} />
      </VariableProvider>
    </TimeRangeProviderBasic>
  );

  await act(async () => {
    await userEvent.click(screen.getByRole('button', { name: 'load options' }));
  });
  await act(async () => {
    await userEvent.click(screen.getByRole('button', { name: 'set definitions' }));
  });
};

describe('VariableProvider setVariableDefinitions', () => {
  it('should keep the loaded options when the definitions are set again unchanged', async () => {
    await renderAndReset([createDefinition()]);

    expect(screen.getByText('expanded: ["test_value_1","test_value_2"]')).toBeTruthy();
  });

  it('should keep the loaded options when a field outside the variable plugin changes', async () => {
    await renderAndReset([createDefinition({ displayName: 'Test label 2' })]);

    expect(screen.getByText('expanded: ["test_value_1","test_value_2"]')).toBeTruthy();
  });

  it('should clear the loaded options when the variable plugin changes', async () => {
    await renderAndReset([createDefinition({ values: ['test_value_3'] })]);

    expect(screen.getByText('expanded: []')).toBeTruthy();
  });
});
