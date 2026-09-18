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

import React, {
  createContext,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// LOGZ.IO CHANGE START:: split the focus context in two [unidash-perf]
// The focused key changes on every panel enter and leave, but the only consumer that reads it is
// useDashboardShortcuts. When the setters and the key shared one context value, every GridItemContent
// on the dashboard re-rendered on each crossing (measured: 3-4 React tasks of 60-110ms, and a scroll
// past mounted panels is a stream of crossings). Splitting keeps the handler subscribers on a value
// that never changes.
interface PanelFocusSetters {
  setFocusedPanel: (panelKey: string) => void;
  clearFocusedPanel: () => void;
}

const NO_PROVIDER = Symbol('no-panel-focus-provider');

const PanelFocusSettersContext = createContext<PanelFocusSetters | typeof NO_PROVIDER>(NO_PROVIDER);
const FocusedPanelKeyContext = createContext<string | null | typeof NO_PROVIDER>(NO_PROVIDER);

const MISSING_PROVIDER_ERROR = 'Panel focus hooks must be used within a PanelFocusProvider';

function usePanelFocusSetters(): PanelFocusSetters {
  const setters = useContext(PanelFocusSettersContext);
  if (setters === NO_PROVIDER) {
    throw new Error(MISSING_PROVIDER_ERROR);
  }
  return setters;
}

/** Tracks which dashboard panel is currently focused (hovered) for panel-scoped shortcuts. */
export function PanelFocusProvider({ children }: { children: ReactNode }): ReactElement {
  const [focusedPanelKey, setFocusedPanelKeyState] = useState<string | null>(null);

  // This wrapper narrow the setter type (string-only / null-only) and provide
  // stable references for the useMemo context value below. React guarantees
  // setFocusedPanelKeyState is stable, but useCallback makes the stability
  // explicit and satisfies exhaustive-deps when used in useMemo.
  const setFocusedPanel = useCallback((panelKey: string) => {
    setFocusedPanelKeyState(panelKey);
  }, []);

  const clearFocusedPanel = useCallback(() => {
    setFocusedPanelKeyState(null);
  }, []);

  const setters = useMemo(
    (): PanelFocusSetters => ({
      setFocusedPanel,
      clearFocusedPanel,
    }),
    [setFocusedPanel, clearFocusedPanel]
  );

  return (
    <PanelFocusSettersContext.Provider value={setters}>
      <FocusedPanelKeyContext.Provider value={focusedPanelKey}>{children}</FocusedPanelKeyContext.Provider>
    </PanelFocusSettersContext.Provider>
  );
}

export function useFocusedPanel(): string | null {
  const focusedPanelKey = useContext(FocusedPanelKeyContext);
  if (focusedPanelKey === NO_PROVIDER) {
    throw new Error(MISSING_PROVIDER_ERROR);
  }
  return focusedPanelKey;
}
// LOGZ.IO CHANGE END:: split the focus context in two [unidash-perf]

const PANEL_FOCUS_DEBOUNCE_MS = 50;

/** Debounced mouse enter/leave handlers for panel focus. Add `tabIndex={-1}` to the panel element. */
export function usePanelFocusHandlers(panelKey: string): {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
} {
  const { setFocusedPanel, clearFocusedPanel } = usePanelFocusSetters(); // LOGZ.IO CHANGE:: setters only [unidash-perf]
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const element = e.currentTarget;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setFocusedPanel(panelKey);
        element.focus({ preventScroll: true });
        timerRef.current = null;
      }, PANEL_FOCUS_DEBOUNCE_MS);
    },
    [panelKey, setFocusedPanel]
  );

  const onMouseLeave = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    clearFocusedPanel();
  }, [clearFocusedPanel]);

  useEffect(() => {
    return (): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return useMemo(() => ({ onMouseEnter, onMouseLeave }), [onMouseEnter, onMouseLeave]);
}
