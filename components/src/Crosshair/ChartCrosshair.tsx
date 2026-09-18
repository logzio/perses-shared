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

// LOGZ.IO ADDITION:: DOM crosshair, replacing the ECharts axis pointer [unidash-perf]
// The axis pointer draws on the chart canvas, which means every pointer event repainted every series
// of every chart in the sync group to move a one-pixel line (measured: ~100 stroke calls per chart
// per event, 6 charts on screen). This draws the same line as a positioned element the compositor
// moves, so no canvas is touched while the cursor travels.

import { MutableRefObject, ReactElement, useEffect, useId, useRef } from 'react';
import { Box } from '@mui/material';
import type { ECharts as EChartsInstance } from 'echarts/core';
import { useMousePosition } from '../TimeSeriesTooltip/tooltip-model';
import { getGridRect, getPointInGrid } from '../utils/chart-actions';
import {
  clearSharedCrosshair,
  getSharedCrosshair,
  setSharedCrosshair,
  subscribeToSharedCrosshair,
} from './crosshair-store';

export interface ChartCrosshairProps {
  chartRef: MutableRefObject<EChartsInstance | undefined>;
  /**
   * When false this chart is isolated: it neither publishes its cursor position nor follows another
   * chart's. Mirrors what `syncGroup` used to control.
   */
  syncEnabled?: boolean;
  /** Hides the line without unsubscribing, for panels that opt out of the crosshair entirely. */
  hidden?: boolean;
}

/**
 * Draws the shared crosshair for one chart and, while the cursor is over it, publishes the hovered
 * timestamp for the other charts to draw.
 */
export function ChartCrosshair({ chartRef, syncEnabled = true, hidden = false }: ChartCrosshairProps): ReactElement {
  const lineRef = useRef<HTMLDivElement | null>(null);
  const sourceId = useId();

  // Scoped to this chart's canvas, so moves over other panels do not re-render this component.
  const mousePos = useMousePosition(chartRef);

  useEffect(
    function publishHoveredTimestamp() {
      if (!syncEnabled) return;

      const chart = chartRef.current;
      if (mousePos === null || chart === undefined) {
        clearSharedCrosshair(sourceId);
        return;
      }

      // Same conversion the tooltip uses, so the line and the tooltip always agree on the bucket.
      const pointInGrid = getPointInGrid(
        mousePos.plotCanvas.x ?? Number.NaN,
        mousePos.plotCanvas.y ?? Number.NaN,
        chart
      );
      const timestampMs = pointInGrid?.[0];
      if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) {
        clearSharedCrosshair(sourceId);
        return;
      }

      setSharedCrosshair({ timestampMs, sourceId });
    },
    [mousePos, chartRef, sourceId, syncEnabled]
  );

  useEffect(
    function releaseCrosshairOnUnmount() {
      // Leaving the chart for good (unmount, or the panel scrolling out) must not strand the line.
      return (): void => clearSharedCrosshair(sourceId);
    },
    [sourceId]
  );

  useEffect(
    function drawLineOnSharedCrosshairChange() {
      const draw = (): void => {
        const element = lineRef.current;
        if (element === null) return;

        const crosshair = getSharedCrosshair();
        const chart = chartRef.current;
        const rect = chart === undefined || chart.isDisposed() ? undefined : getGridRect(chart);

        if (hidden || crosshair === null || chart === undefined || rect === undefined) {
          element.style.visibility = 'hidden';
          return;
        }

        // Not `syncEnabled` means only this chart's own cursor may draw here.
        if (!syncEnabled && crosshair.sourceId !== sourceId) {
          element.style.visibility = 'hidden';
          return;
        }

        const x = chart.convertToPixel({ xAxisIndex: 0 }, crosshair.timestampMs);
        if (typeof x !== 'number' || !Number.isFinite(x) || x < rect.x || x > rect.x + rect.width) {
          element.style.visibility = 'hidden';
          return;
        }

        element.style.transform = `translate(${x}px, ${rect.y}px)`;
        element.style.height = `${rect.height}px`;
        element.style.visibility = 'visible';
      };

      draw();
      return subscribeToSharedCrosshair(draw);
    },
    [chartRef, hidden, sourceId, syncEnabled]
  );

  return (
    <Box
      ref={lineRef}
      aria-hidden
      sx={(theme) => ({
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        // Matches the ECharts axis-pointer default this replaces.
        borderLeft: `1px dashed ${theme.palette.text.secondary}`,
        opacity: 0.8,
        visibility: 'hidden',
        pointerEvents: 'none',
        zIndex: 1,
      })}
    />
  );
}
