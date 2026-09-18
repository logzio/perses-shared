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
// A list variable re-publishes its options on every auto-refresh tick, and every panel on the
// dashboard is a variable consumer. The store keeps the previous list when the new one holds the
// same options, and the selector's equality compares those lists by reference — the two belong
// together, so this covers them as a pair.

import { ReactElement, useState } from 'react';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeRangeProviderBasic, useVariableValues, VariableOption } from '@perses-dev/plugin-system';
import { VariableDefinition } from '@perses-dev/spec';
import { renderWithContext } from '../../test';
import { useVariableDefinitionActions, VariableProvider } from './VariableProvider';

const definitions: VariableDefinition[] = [
  {
    kind: 'ListVariable',
    spec: {
      name: 'cluster',
      allowAllValue: false,
      allowMultiple: false,
      plugin: { kind: 'StaticListVariable', spec: { values: ['test_value_1'] } },
    },
  },
];

const OPTIONS: VariableOption[] = [
  { value: 'test_value_1', label: 'Test label 1' },
  { value: 'test_value_2', label: 'Test label 2' },
];

const consumerRenders = { current: 0 };

function Consumer(): ReactElement {
  consumerRenders.current += 1;
  const values = useVariableValues();

  return <div>{`cluster: ${String(values['cluster']?.value)}`}</div>;
}

// Reused element: React skips a child whose element is referentially identical, so every render the
// consumer does comes from the variable state it subscribes to, not from its parent.
const CONSUMER = <Consumer />;

function Writer(): ReactElement {
  const { setVariableOptions } = useVariableDefinitionActions();

  return (
    <>
      <button
        onClick={(): void =>
          setVariableOptions(
            'cluster',
            OPTIONS.map((option) => ({ ...option }))
          )
        }
      >
        publish options
      </button>
      <button onClick={(): void => setVariableOptions('cluster', [{ value: 'test_value_3', label: 'Test label 3' }])}>
        publish other options
      </button>
    </>
  );
}

function Host(): ReactElement {
  const [tick, setTick] = useState(0);

  return (
    <TimeRangeProviderBasic initialRefreshInterval="0s" initialTimeRange={{ pastDuration: '30m' }}>
      <VariableProvider initialVariableDefinitions={definitions}>
        {CONSUMER}
        <Writer />
      </VariableProvider>
      <button onClick={(): void => setTick(tick + 1)}>rerender</button>
    </TimeRangeProviderBasic>
  );
}

const click = async (name: string): Promise<void> => {
  await act(async () => {
    await userEvent.click(screen.getByRole('button', { name }));
  });
};

describe('VariableProvider options writes', () => {
  it('should not re-render variable consumers when a refresh republishes the same options', async () => {
    renderWithContext(<Host />);
    await click('publish options');

    const rendersAfterFirstPublish = consumerRenders.current;
    await click('publish options');
    await click('publish options');

    expect(consumerRenders.current).toBe(rendersAfterFirstPublish);
  });

  it('should re-render variable consumers when the options actually change', async () => {
    renderWithContext(<Host />);
    await click('publish options');

    const rendersAfterFirstPublish = consumerRenders.current;
    await click('publish other options');

    expect(consumerRenders.current).toBeGreaterThan(rendersAfterFirstPublish);
  });
});
