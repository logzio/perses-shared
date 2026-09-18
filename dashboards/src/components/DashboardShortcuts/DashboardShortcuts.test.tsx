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

// LOGZ.IO ADDITION:: the shortcuts hook must not drag its host component into every focus change [unidash-perf]

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { PanelFocusProvider, useFocusedPanel, usePanelFocusHandlers } from '../../keyboard-shortcuts';
import { DashboardShortcuts } from './DashboardShortcuts';

// The real hook needs the dashboard store, time range and snackbar providers. What matters here is
// only that it subscribes to the focused-panel key, so stand in with a hook that does exactly that.
const hookRenders = { current: 0 };
jest.mock('./useDashboardShortcuts', () => ({
  useDashboardShortcuts: (): void => {
    hookRenders.current += 1;
    jest.requireActual<typeof import('../../keyboard-shortcuts')>('../../keyboard-shortcuts').useFocusedPanel();
  },
}));

function FocusTarget(): ReactElement {
  const { onMouseEnter, onMouseLeave } = usePanelFocusHandlers('panel-1');
  return <div data-testid="panel" tabIndex={-1} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />;
}

function FocusReadout(): ReactElement {
  return <div data-testid="focused">{useFocusedPanel() ?? 'none'}</div>;
}

describe('DashboardShortcuts', () => {
  test('should render nothing', () => {
    const { container } = render(
      <PanelFocusProvider>
        <DashboardShortcuts isReadonly={false} onEditButtonClick={jest.fn()} onCancelButtonClick={jest.fn()} />
      </PanelFocusProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });

  test('should keep focus changes inside the leaf instead of re-rendering the host', () => {
    const hostRenders = { current: 0 };

    function Host(): ReactElement {
      hostRenders.current += 1;
      return (
        <>
          <DashboardShortcuts isReadonly={false} onEditButtonClick={jest.fn()} onCancelButtonClick={jest.fn()} />
          <FocusTarget />
          <FocusReadout />
        </>
      );
    }

    jest.useFakeTimers();
    try {
      render(
        <PanelFocusProvider>
          <Host />
        </PanelFocusProvider>
      );
      const hostRendersAfterMount = hostRenders.current;
      const hookRendersAfterMount = hookRenders.current;

      act(() => {
        fireEvent.mouseEnter(screen.getByTestId('panel'));
        jest.advanceTimersByTime(50);
      });
      expect(screen.getByTestId('focused').textContent).toBe('panel-1');

      act(() => {
        fireEvent.mouseLeave(screen.getByTestId('panel'));
      });
      expect(screen.getByTestId('focused').textContent).toBe('none');

      // the leaf followed the key, the host did not
      expect(hookRenders.current).toBeGreaterThan(hookRendersAfterMount);
      expect(hostRenders.current).toBe(hostRendersAfterMount);
    } finally {
      jest.useRealTimers();
    }
  });
});
