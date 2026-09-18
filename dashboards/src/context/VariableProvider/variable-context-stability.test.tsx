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

// LOGZ.IO ADDITION:: a context read bypasses `memo`, so a fresh context value here re-renders every
// panel on the dashboard whenever this provider's parent renders — with no variable change at all.
// [unidash-perf]

import { ReactElement, useState } from 'react';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeRangeProviderBasic, useVariableValues } from '@perses-dev/plugin-system';
import { VariableDefinition } from '@perses-dev/spec';
import { renderWithContext } from '../../test';
import { VariableProvider } from './VariableProvider';

const definitions: VariableDefinition[] = [{ kind: 'TextVariable', spec: { name: 'cluster', value: 'test_value_1' } }];

const probeRenders = { current: 0 };

function Probe(): ReactElement {
  probeRenders.current += 1;
  const values = useVariableValues();

  return <div>{`cluster: ${String(values['cluster']?.value)}`}</div>;
}

// One element, reused across renders: React skips re-rendering a child whose element is
// referentially identical, so any render the probe does comes from the context, not from its parent.
const PROBE = <Probe />;

function Host(): ReactElement {
  const [tick, setTick] = useState(0);

  return (
    <TimeRangeProviderBasic initialRefreshInterval="0s" initialTimeRange={{ pastDuration: '30m' }}>
      <VariableProvider initialVariableDefinitions={definitions}>{PROBE}</VariableProvider>
      <button onClick={(): void => setTick(tick + 1)}>rerender</button>
    </TimeRangeProviderBasic>
  );
}

describe('VariableProvider context stability', () => {
  it('should not re-render variable consumers when the provider re-renders with unchanged values', async () => {
    renderWithContext(<Host />);
    expect(screen.getByText('cluster: test_value_1')).toBeInTheDocument();

    const rendersAfterMount = probeRenders.current;
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'rerender' }));
    });

    expect(probeRenders.current).toBe(rendersAfterMount);
  });
});
