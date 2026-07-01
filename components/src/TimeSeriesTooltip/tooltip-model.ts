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

import { useEffect, useState } from 'react';
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

export const useMousePosition = (): CursorData['coords'] => {
  const [coords, setCoords] = useState<CursorData['coords']>(null);

  // LOGZ.IO CHANGE START:: coalesce mouse tracking to one update per animation frame, and skip
  // updates while the cursor stays off any chart canvas. Previously this fired a React setState on
  // EVERY native mousemove, and one listener is mounted per panel — so a single mouse move re-rendered
  // every tooltip. Combined with large series counts that flooded the main thread and the
  // GC/cycle-collector (see Firefox profile: ~76% CPU in cycle collection). [unidash-perf]
  useEffect(() => {
    let rafId: number | null = null;
    let latestEvent: ZRRawMouseEvent | null = null;
    // Whether the last position we emitted was over a chart canvas. Lets us emit a single update
    // when the cursor leaves a canvas (so the tooltip hides), then ignore further off-canvas moves
    // until it returns — and most of the viewport (gaps, headers, the rest of the page) is not a chart.
    let lastTargetWasCanvas = false;

    const flush = (): void => {
      rafId = null;
      const event = latestEvent;
      latestEvent = null;
      if (event === null) return;

      const targetIsCanvas = (event.target as HTMLElement | null)?.tagName === 'CANVAS';
      if (!targetIsCanvas && !lastTargetWasCanvas) return;
      lastTargetWasCanvas = targetIsCanvas;

      setCoords({
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
        // necessary to check whether cursor target matches correct chart canvas (since each chart has its own mousemove listener)
        target: event.target,
      });
    };

    const setFromEvent = (e: ZRRawMouseEvent): void => {
      latestEvent = e;
      if (rafId === null) {
        rafId = requestAnimationFrame(flush);
      }
    };
    window.addEventListener('mousemove', setFromEvent, { passive: true });

    return (): void => {
      window.removeEventListener('mousemove', setFromEvent);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);
  // LOGZ.IO CHANGE END:: coalesce mouse tracking [unidash-perf]

  return coords;
};
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
