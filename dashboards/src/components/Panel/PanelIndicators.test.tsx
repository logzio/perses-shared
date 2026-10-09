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

// LOGZ.IO CHANGE:: whole file, tests for the panel's warning indicators

import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelNotice, SERIES_LIMIT_NOTICE_KIND } from '@perses-dev/plugin-system';
import { renderWithContext } from '../../test';
import { PanelIndicators, PanelIndicatorsProps } from './PanelIndicators';

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
const ERRORS_LABEL = 'panel errors';

/** One query result per notice list. Only the notices matter here, so the rest is a stub. */
const queryResultsWithNotices = (...noticesPerQuery: PanelNotice[][]): PanelIndicatorsProps['queryResults'] =>
  noticesPerQuery.map((notices) => ({
    data: { series: [], metadata: { notices } },
    isFetching: false,
    isLoading: false,
  })) as unknown as PanelIndicatorsProps['queryResults'];

const renderIndicators = (queryResults: PanelIndicatorsProps['queryResults']): ReturnType<typeof renderWithContext> =>
  renderWithContext(<PanelIndicators queryResults={queryResults} />);

const hoveredTooltipText = async (label: string): Promise<string> => {
  await act(async () => {
    await userEvent.hover(screen.getByRole('button', { name: label }));
  });

  return (await screen.findByRole('tooltip')).textContent ?? '';
};

describe('PanelIndicators', () => {
  it('should render nothing when there are no errors or notices', () => {
    const { container } = renderIndicators(queryResultsWithNotices([]));

    expect(container).toBeEmptyDOMElement();
  });

  it('should show a query error indicator when a query fails', () => {
    renderIndicators([
      { error: new Error('test error'), isFetching: false, isLoading: false },
    ] as unknown as PanelIndicatorsProps['queryResults']);

    expect(screen.getByRole('button', { name: ERRORS_LABEL })).toBeInTheDocument();
  });

  it('should keep the query error indicator while the panel refetches', () => {
    renderIndicators([
      { data: { series: [] }, error: new Error('test error'), isFetching: true, isLoading: false },
    ] as unknown as PanelIndicatorsProps['queryResults']);

    expect(screen.getByRole('button', { name: ERRORS_LABEL })).toBeInTheDocument();
  });

  it('should show the series limit notice and the general notice as separate indicators when a panel reports both', () => {
    renderIndicators(queryResultsWithNotices([SERIES_LIMIT_NOTICE], [ANNOTATION_NOTICE]));

    expect(screen.getByRole('button', { name: SERIES_LIMIT_LABEL })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: NOTICES_LABEL })).toBeInTheDocument();
  });

  it('should not show a general notices indicator when the series limit is the only notice', () => {
    renderIndicators(queryResultsWithNotices([SERIES_LIMIT_NOTICE]));

    expect(screen.getByRole('button', { name: SERIES_LIMIT_LABEL })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: NOTICES_LABEL })).not.toBeInTheDocument();
  });

  it('should not show a series limit indicator when only a general notice is reported', () => {
    renderIndicators(queryResultsWithNotices([ANNOTATION_NOTICE]));

    expect(screen.queryByRole('button', { name: SERIES_LIMIT_LABEL })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: NOTICES_LABEL })).toBeInTheDocument();
  });

  it('should list every general notice in the notices tooltip', async () => {
    renderIndicators(queryResultsWithNotices([ANNOTATION_NOTICE], [FILTERS_NOTICE]));

    const text = await hoveredTooltipText(NOTICES_LABEL);

    expect(text).toContain(ANNOTATION_NOTICE.message);
    expect(text).toContain(FILTERS_NOTICE.message);
  });

  it('should keep the general notices indicator at warning severity when an info notice is also reported', () => {
    renderIndicators(queryResultsWithNotices([ANNOTATION_NOTICE, FILTERS_NOTICE]));

    const button = screen.getByRole('button', { name: NOTICES_LABEL });

    expect(button.querySelector('.MuiSvgIcon-colorWarning')).toBeInTheDocument();
    expect(button.querySelector('.MuiSvgIcon-colorInfo')).not.toBeInTheDocument();
  });

  it('should report the series limit once in its tooltip when several queries hit the same limit', async () => {
    renderIndicators(queryResultsWithNotices([SERIES_LIMIT_NOTICE], [SERIES_LIMIT_NOTICE]));

    const text = await hoveredTooltipText(SERIES_LIMIT_LABEL);

    expect(text).toBe(SERIES_LIMIT_NOTICE.message);
  });
});
