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
});
