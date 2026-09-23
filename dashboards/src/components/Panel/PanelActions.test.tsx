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
// `OnHover` used to be declared inside the component, which made it a new element type on every
// render: React then unmounted and remounted every action below it. A panel header re-renders
// whenever any variable on the dashboard reports a change, so this ran ~5,200 fibers per panel per
// auto-refresh tick.

import { ReactElement, useState } from 'react';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelNotice, SERIES_LIMIT_NOTICE_KIND } from '@perses-dev/plugin-system';
import { renderWithContext } from '../../test';
import { PanelActions, PanelActionsProps } from './PanelActions';

const PANEL_TITLE = 'Test panel 1';
const VIEW_PANEL_LABEL = `toggle panel ${PANEL_TITLE} view mode`;

const READ_HANDLERS: PanelActionsProps['readHandlers'] = { onViewPanelClick: (): void => undefined };
const QUERY_RESULTS: PanelActionsProps['queryResults'] = [];

function Host({ showIcons }: { showIcons: PanelActionsProps['showIcons'] }): ReactElement {
  const [tick, setTick] = useState(0);

  return (
    <>
      <PanelActions
        title={PANEL_TITLE}
        descriptionTooltipId="test-description"
        queryResults={QUERY_RESULTS}
        readHandlers={READ_HANDLERS}
        showIcons={showIcons}
      />
      <button onClick={(): void => setTick(tick + 1)}>rerender</button>
    </>
  );
}

const SERIES_LIMIT_NOTICE: PanelNotice = {
  type: 'warning',
  kind: SERIES_LIMIT_NOTICE_KIND,
  message: 'Showing the first 100 of 302 series.',
};
const ANNOTATION_NOTICE: PanelNotice = {
  type: 'warning',
  message: 'PromQL info: metric might not be a counter: "test_metric_1"',
};
const FILTERS_NOTICE: PanelNotice = { type: 'info', message: 'Ad-Hoc Filters are applied to the query' };

const SERIES_LIMIT_LABEL = 'panel series limit notices';
const NOTICES_LABEL = 'panel notices';

/** One query result per notice list. Only the notices matter here, so the rest is a stub. */
const queryResultsWithNotices = (...noticesPerQuery: PanelNotice[][]): PanelActionsProps['queryResults'] =>
  noticesPerQuery.map((notices) => ({
    data: { series: [], metadata: { notices } },
    isFetching: false,
    isLoading: false,
  })) as unknown as PanelActionsProps['queryResults'];

const renderWithNotices = (...noticesPerQuery: PanelNotice[][]): void => {
  renderWithContext(
    <PanelActions
      title={PANEL_TITLE}
      descriptionTooltipId="test-description"
      queryResults={queryResultsWithNotices(...noticesPerQuery)}
      readHandlers={READ_HANDLERS}
      showIcons="always"
    />
  );
};

const hoveredTooltipText = async (label: string): Promise<string> => {
  await act(async () => {
    await userEvent.hover(screen.getAllByRole('button', { name: label })[0]!);
  });

  return (await screen.findByRole('tooltip')).textContent ?? '';
};

const getViewButtons = (): HTMLElement[] => screen.getAllByRole('button', { name: VIEW_PANEL_LABEL });

const rerender = async (): Promise<void> => {
  await act(async () => {
    await userEvent.click(screen.getByRole('button', { name: 'rerender' }));
  });
};

describe('PanelActions', () => {
  it('should keep its action buttons mounted when it re-renders with unchanged props on hover', async () => {
    renderWithContext(<Host showIcons="hover" />);
    const before = getViewButtons();
    expect(before.length).toBeGreaterThan(0);

    await rerender();

    const after = getViewButtons();
    expect(after.length).toBe(before.length);
    after.forEach((button, index) => expect(button).toBe(before[index]));
  });

  it('should keep its action buttons mounted when it re-renders with unchanged props and icons always shown', async () => {
    renderWithContext(<Host showIcons="always" />);
    const before = getViewButtons();
    expect(before.length).toBeGreaterThan(0);

    await rerender();

    const after = getViewButtons();
    expect(after.length).toBe(before.length);
    after.forEach((button, index) => expect(button).toBe(before[index]));
  });

  it('should show the series limit notice and the general notice as separate indicators when a panel reports both', () => {
    renderWithNotices([SERIES_LIMIT_NOTICE], [ANNOTATION_NOTICE]);

    expect(screen.getAllByRole('button', { name: SERIES_LIMIT_LABEL }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: NOTICES_LABEL }).length).toBeGreaterThan(0);
  });

  it('should not show a general notices indicator when the series limit is the only notice', () => {
    renderWithNotices([SERIES_LIMIT_NOTICE]);

    expect(screen.getAllByRole('button', { name: SERIES_LIMIT_LABEL }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: NOTICES_LABEL })).not.toBeInTheDocument();
  });

  it('should not show a series limit indicator when only a general notice is reported', () => {
    renderWithNotices([ANNOTATION_NOTICE]);

    expect(screen.queryByRole('button', { name: SERIES_LIMIT_LABEL })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: NOTICES_LABEL }).length).toBeGreaterThan(0);
  });

  it('should list every general notice in the notices tooltip', async () => {
    renderWithNotices([ANNOTATION_NOTICE], [FILTERS_NOTICE]);

    const text = await hoveredTooltipText(NOTICES_LABEL);

    expect(text).toContain(ANNOTATION_NOTICE.message);
    expect(text).toContain(FILTERS_NOTICE.message);
  });

  it('should keep the general notices indicator at warning severity when an info notice is also reported', () => {
    renderWithNotices([ANNOTATION_NOTICE, FILTERS_NOTICE]);

    const button = screen.getAllByRole('button', { name: NOTICES_LABEL })[0]!;

    expect(button.querySelector('.MuiSvgIcon-colorWarning')).toBeInTheDocument();
    expect(button.querySelector('.MuiSvgIcon-colorInfo')).not.toBeInTheDocument();
  });

  it('should report the series limit once in its tooltip when several queries hit the same limit', async () => {
    renderWithNotices([SERIES_LIMIT_NOTICE], [SERIES_LIMIT_NOTICE]);

    const text = await hoveredTooltipText(SERIES_LIMIT_LABEL);

    expect(text).toBe(SERIES_LIMIT_NOTICE.message);
  });
});
