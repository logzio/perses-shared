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
// A panel's header actions used to be built by an effect that awaited the plugin and kept the
// rendered elements in state. Every render that changed the query results therefore committed
// twice, and in between the header showed actions built from the previous render's data.

import { Profiler, ReactElement, useState } from 'react';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelDefinition } from '@perses-dev/spec';
import { QueryData, TimeRangeProviderBasic } from '@perses-dev/plugin-system';
import { fakeHeaderActionRenders, renderWithContext } from '../../test';
import { VariableProvider } from '../../context';
import { Panel } from './Panel';

const mockQueryResults: { current: QueryData[] } = { current: [] };

jest.mock('@perses-dev/plugin-system', () => ({
  ...jest.requireActual('@perses-dev/plugin-system'),
  useDataQueriesContext: (): { queryResults: QueryData[]; isFetching: boolean; isLoading: boolean } => ({
    queryResults: mockQueryResults.current,
    isFetching: false,
    isLoading: false,
  }),
}));

// `QueryData.error` is typed as a non-nullable Error upstream, though react-query reports null.
const queryResult = (seriesName: string): QueryData =>
  ({
    definition: { kind: 'TimeSeriesQuery', spec: { plugin: { kind: 'PrometheusTimeSeriesQuery', spec: {} } } },
    data: { series: [{ name: seriesName, values: [] }] },
    isFetching: false,
    isLoading: false,
  }) as unknown as QueryData;

const ONE_RESULT: QueryData[] = [queryResult('test_series_1')];
const TWO_RESULTS: QueryData[] = [queryResult('test_series_1'), queryResult('test_series_2')];

const definition: PanelDefinition = {
  kind: 'Panel',
  spec: {
    display: { name: 'Test panel 1' },
    plugin: { kind: 'ActionsChart', spec: {} },
    queries: [],
  },
};

const panelCommits: number[] = [];

function Host(): ReactElement {
  const [, setTick] = useState(0);

  return (
    <TimeRangeProviderBasic initialRefreshInterval="0s" initialTimeRange={{ pastDuration: '1h' }}>
      <VariableProvider initialVariableDefinitions={[]}>
        <Profiler id="panel" onRender={(): void => void panelCommits.push(panelCommits.length)}>
          <Panel definition={definition} panelOptions={{ showIcons: 'always' }} />
        </Profiler>
      </VariableProvider>
      <button
        onClick={(): void => {
          mockQueryResults.current = TWO_RESULTS;
          setTick((tick) => tick + 1);
        }}
      >
        load more data
      </button>
    </TimeRangeProviderBasic>
  );
}

describe('Panel plugin actions', () => {
  it('should show the header action the query results of the render it belongs to, in one commit', async () => {
    mockQueryResults.current = ONE_RESULT;
    fakeHeaderActionRenders.length = 0;
    panelCommits.length = 0;
    renderWithContext(<Host />);

    expect(await screen.findByTestId('plugin-action')).toHaveTextContent('series: 1');

    const commitsBeforeChange = panelCommits.length;
    const rendersBeforeChange = fakeHeaderActionRenders.length;
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'load more data' }));
    });

    expect(screen.getByTestId('plugin-action')).toHaveTextContent('series: 2');
    // Actions resolved during render reach the DOM with the render that produced them. Resolving
    // them in an effect instead costs a second commit for every change of the query results, and
    // leaves the header holding the superseded ones in between.
    expect(panelCommits.length - commitsBeforeChange).toBe(1);
    expect(fakeHeaderActionRenders.slice(rendersBeforeChange)).toEqual([TWO_RESULTS.length]);
  });
});
