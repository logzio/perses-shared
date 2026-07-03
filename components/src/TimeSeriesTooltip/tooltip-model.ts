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

import { useCallback, useSyncExternalStore } from 'react';
import { NearbySeriesArray, NearbySeriesInfo } from './types';

export const TOOLTIP_MIN_WIDTH = 375;
export const TOOLTIP_MAX_WIDTH = 650;
export const TOOLTIP_MAX_HEIGHT = 650;
export const TOOLTIP_LABELS_MAX_WIDTH = TOOLTIP_MAX_WIDTH - 150;
export const TOOLTIP_ADJUST_Y_POS_MULTIPLIER = 0.75;
export const TOOLTIP_PADDING = 8;

export const FALLBACK_CHART_WIDTH = 750;

export const NEARBY_SERIES_DESCRIPTION = 'nearby series showing in tooltip';
export const EMPHASIZED_SERIES_DESCRIPTION = 'emphasized series showing as bold in tooltip';

export const TOOLTIP_BG_COLOR_FALLBACK = '#2E313E';

export const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hour12: true,
});

export const defaultCursorData = {
  coords: {
    plotCanvas: {
      x: 0,
      y: 0,
    },
    zrender: {
      x: 0,
      y: 0,
    },
    target: null,
  },
  chartWidth: 0,
};

export const EMPTY_TOOLTIP_DATA: NearbySeriesArray = [];

/**
 * ECharts is built with zrender, zrX and zrY are undefined when not hovering over a chart canvas
 */
export interface ZRCoordinate {
  x?: number;
  y?: number;
}

export interface Coordinate {
  x: number;
  y: number;
}

export interface CursorCoordinates {
  page: Coordinate;
  client: Coordinate;
  plotCanvas: ZRCoordinate;
  target: EventTarget | null;
}

export interface CursorData {
  coords: CursorCoordinates | null;
  chartWidth?: number;
}

export interface TooltipData {
  focusedSeries: NearbySeriesArray | null;
  cursor: CursorData;
}

type ZREventProperties = {
  zrX?: number;
  zrY?: number;
  zrDelta?: number;
  zrEventControl?: 'no_globalout' | 'only_globalout';
  zrByTouch?: boolean;
};

export type ZRRawMouseEvent = MouseEvent & ZREventProperties;

// LOGZ.IO CHANGE START:: shared, frame-coalesced mouse-position store [unidash-perf]
// A single window listener feeds all tooltip subscribers via useSyncExternalStore. Previously each
// panel mounted its own listener + local state, so one mouse move re-rendered EVERY panel's tooltip;
// with a per-chart snapshot (see useMousePosition below) only the hovered panel re-renders — the
// other panels' snapshot stays `null`, which useSyncExternalStore skips (Object.is-equal).
// Semantics preserved from the previous per-panel hook: updates coalesce to one per animation frame,
// the first move onto a canvas flushes synchronously (hover-enter latency), moving off a canvas emits
// one final update (so tooltips hide), and further off-canvas moves are ignored.

/** Minimal structural view of an ECharts instance — avoids importing echarts types here. */
export interface ChartDomProvider {
  getDom: () => HTMLElement;
}

const isCanvasTarget = (target: EventTarget | null): boolean => (target as HTMLElement | null)?.tagName === 'CANVAS';

let storeCoords: CursorCoordinates | null = null;
let storeRafId: number | null = null;
let storeLatestEvent: ZRRawMouseEvent | null = null;
// Whether the last position we emitted was over a chart canvas. Lets us emit a single update when
// the cursor leaves a canvas (so the tooltip hides), then ignore further off-canvas moves until it
// returns — and most of the viewport (gaps, headers, the rest of the page) is not a chart.
let storeLastTargetWasCanvas = false;
const storeListeners = new Set<() => void>();

const flushMouseStore = (): void => {
  storeRafId = null;
  const event = storeLatestEvent;
  storeLatestEvent = null;
  if (event === null) return;

  const targetIsCanvas = isCanvasTarget(event.target);
  if (!targetIsCanvas && !storeLastTargetWasCanvas) return;
  storeLastTargetWasCanvas = targetIsCanvas;

  storeCoords = {
    page: {
      x: event.pageX,
      y: event.pageY,
    },
    client: {
      x: event.clientX,
      y: event.clientY,
    },
    plotCanvas: {
      // Default to zrender mousemove coords since they handle browser inconsistencies for us
      // ex: Firefox and Chrome have slightly different implementations of offsetX and offsetY
      // more info: https://github.com/ecomfe/zrender/blob/5.5.0/src/core/event.ts#L46-L120
      // Fallback to offsetX and offsetY to ensure tooltip works correctly in Edge
      x: event.zrX ?? event.offsetX,
      y: event.zrY ?? event.offsetY,
    },
    // used by per-chart snapshots to decide which chart's tooltip the cursor belongs to
    target: event.target,
  };
  storeListeners.forEach((listener) => listener());
};

const handleMouseStoreMove = (e: ZRRawMouseEvent): void => {
  storeLatestEvent = e;

  // Flush synchronously on the first move onto a canvas so the tooltip doesn't wait an extra
  // animation frame to appear (hover-enter latency); subsequent moves stay frame-coalesced.
  const enteringCanvas = !storeLastTargetWasCanvas && isCanvasTarget(e.target);
  if (enteringCanvas) {
    if (storeRafId !== null) {
      cancelAnimationFrame(storeRafId);
    }
    flushMouseStore();
    return;
  }

  if (storeRafId === null) {
    storeRafId = requestAnimationFrame(flushMouseStore);
  }
};

const subscribeToMouseStore = (onStoreChange: () => void): (() => void) => {
  if (storeListeners.size === 0) {
    window.addEventListener('mousemove', handleMouseStoreMove, { passive: true });
  }
  storeListeners.add(onStoreChange);

  return (): void => {
    storeListeners.delete(onStoreChange);
    if (storeListeners.size === 0) {
      window.removeEventListener('mousemove', handleMouseStoreMove);
      if (storeRafId !== null) {
        cancelAnimationFrame(storeRafId);
        storeRafId = null;
      }
      storeLatestEvent = null;
      storeLastTargetWasCanvas = false;
      storeCoords = null;
    }
  };
};

const getMouseStoreServerSnapshot = (): CursorCoordinates | null => null;

/**
 * Tracks the mouse position over chart canvases (frame-coalesced, shared window listener).
 * Pass the chart's ref to scope the returned coords to that chart: the hook then returns non-null
 * only while the cursor is over THIS chart's own canvas, and the component skips re-renders for
 * moves over other panels entirely.
 */
export const useMousePosition = (chartRef?: { current?: ChartDomProvider | null }): CursorData['coords'] => {
  const getSnapshot = useCallback((): CursorCoordinates | null => {
    const coords = storeCoords;
    if (!chartRef) return coords;
    if (coords === null || !(coords.target instanceof Node)) return null;

    const chartDom = chartRef.current?.getDom();
    if (!chartDom || !isCanvasTarget(coords.target) || !chartDom.contains(coords.target)) return null;

    return coords;
  }, [chartRef]);

  return useSyncExternalStore(subscribeToMouseStore, getSnapshot, getMouseStoreServerSnapshot);
};
// LOGZ.IO CHANGE END:: shared, frame-coalesced mouse-position store [unidash-perf]
// LOGZ.IO CHANGE START:: Drilldown panel [APPZ-377]
export type PointAction = {
  label: string;
  onClick: (point: NearbySeriesInfo) => void;
  icon?: React.JSX.Element;
  // LOGZ.IO CHANGE START:: Per-point action visibility [APPZ-2424]
  isVisible?: (point: NearbySeriesInfo) => boolean;
  // LOGZ.IO CHANGE END:: Per-point action visibility [APPZ-2424]
};

// LOGZ.IO CHANGE START:: Per-point action visibility [APPZ-2424]
export const isActionVisible = (action: PointAction, point: NearbySeriesInfo): boolean => {
  if (typeof action.isVisible !== 'function') return true;

  try {
    return action.isVisible(point);
  } catch {
    return true;
  }
};
// LOGZ.IO CHANGE END:: Per-point action visibility [APPZ-2424]
// LOGZ.IO CHANGE END:: Drilldown panel [APPZ-377]

export type TooltipConfig = {
  wrapLabels: boolean;
  hidden?: boolean;
  enablePinning?: boolean;
  defaultSeriesMode?: 'single' | 'nearby' | 'all'; // LOGZ.IO CHANGE:: Persisted tooltip series mode
};

export const DEFAULT_TOOLTIP_CONFIG: TooltipConfig = {
  wrapLabels: true,
  enablePinning: true,
};

// LOGZ.IO CHANGE START:: Drilldown panel [APPZ-377]
export const DRILLDOWN_HELP_TEXT = 'Click To Drilldown';
export const SELECT_SERIES_HELP_TEXT = 'Select a series to drilldown';
// LOGZ.IO CHANGE END:: Drilldown panel [APPZ-377]
