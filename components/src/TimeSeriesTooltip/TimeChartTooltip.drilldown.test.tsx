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

// LOGZ.IO CHANGE:: drilldown selection of the time series tooltip, driven through the real mouse-position
// store. TimeChartTooltip.test.tsx mocks that store, which hid the frozen tooltip these pin down. [unidash-perf]

import { MutableRefObject, ReactElement } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ECharts as EChartsInstance } from 'echarts/core';
import { TimeSeries } from '@perses-dev/spec';
import { TimeChartTooltip } from './TimeChartTooltip';
import { getNearbySeriesData } from './nearby-series';
import {
  CursorCoordinates,
  EMPHASIZED_SERIES_DESCRIPTION,
  PointAction,
  SELECT_SERIES_HELP_TEXT,
} from './tooltip-model';
import { NearbySeriesArray } from './types';

// jsdom never measures the tooltip, and an unmeasured tooltip renders hidden.
jest.mock('use-resize-observer', () => {
  const ref = (): void => undefined;

  return {
    __esModule: true,
    default: (): { width: number; height: number; ref: () => void } => ({ width: 400, height: 200, ref }),
  };
});
jest.mock('./nearby-series');

type ChartRef = MutableRefObject<EChartsInstance | undefined>;

const FRAME_MS = 16;
const TEST_DATA = [
  { name: 'test_series_0', values: [] },
  { name: 'test_series_1', values: [] },
] as unknown as TimeSeries[];
const PIN_POSITION: CursorCoordinates = {
  page: { x: 100, y: 50 },
  client: { x: 100, y: 50 },
  plotCanvas: { x: 100, y: 50 },
  target: null,
};

function buildNearbySeries(closestSeriesIdx: number): NearbySeriesArray {
  return [0, 1].map((seriesIdx) => ({
    seriesIdx,
    datumIdx: 1,
    seriesName: `test_series_${seriesIdx}`,
    date: 0,
    x: 0,
    y: seriesIdx,
    formattedY: `test_value_${seriesIdx}`,
    markerColor: '#000',
    isClosestToCursor: seriesIdx === closestSeriesIdx,
    isSelected: false,
  }));
}

/** Series 0 is the closest left of x=150 and series 1 right of it, so crossing x=150 changes the selection. */
function mockNearbySeriesByCursorX(): void {
  (getNearbySeriesData as jest.Mock).mockImplementation(({ mousePos }: { mousePos: CursorCoordinates | null }) =>
    mousePos === null ? [] : buildNearbySeries(mousePos.client.x < 150 ? 0 : 1)
  );
}

function renderChartCanvas(): { canvas: HTMLElement; chartRef: ChartRef } {
  const { container } = render(<canvas role="img" aria-label="Test chart" />);
  const chartRef = { current: { getDom: () => container } } as unknown as ChartRef;

  return { canvas: screen.getByRole('img', { name: 'Test chart' }), chartRef };
}

function tooltipElement({
  chartRef,
  pinnedPos,
  pointActions,
  data = TEST_DATA,
}: {
  chartRef: ChartRef;
  pinnedPos: CursorCoordinates | null;
  pointActions: PointAction[];
  data?: TimeSeries[];
}): ReactElement {
  return (
    <TimeChartTooltip
      chartRef={chartRef}
      data={data}
      seriesMapping={[]}
      pinnedPos={pinnedPos}
      pointActions={pointActions}
    />
  );
}

/** A tooltip is pinned by clicking the chart it is already showing on. */
function renderPinnedAfterHover(pointActions: PointAction[]): {
  chartRef: ChartRef;
  rerender: (element: ReactElement) => void;
} {
  const { canvas, chartRef } = renderChartCanvas();
  const { rerender } = render(tooltipElement({ chartRef, pinnedPos: null, pointActions }));

  fireEvent.mouseMove(canvas, { clientX: 100, clientY: 50 });
  rerender(tooltipElement({ chartRef, pinnedPos: PIN_POSITION, pointActions }));

  return { chartRef, rerender };
}

describe('TimeChartTooltip drilldown selection', () => {
  it('should hide the tooltip when the cursor leaves the chart after the selected series changed', () => {
    jest.useFakeTimers();

    try {
      const pointActions = [{ label: 'Test action', onClick: jest.fn() }];
      mockNearbySeriesByCursorX();
      const { canvas, chartRef } = renderChartCanvas();
      render(tooltipElement({ chartRef, pinnedPos: null, pointActions }));

      act(() => {
        fireEvent.mouseMove(canvas, { clientX: 100, clientY: 50 });
      });
      act(() => {
        fireEvent.mouseMove(canvas, { clientX: 200, clientY: 50 });
        jest.advanceTimersByTime(FRAME_MS);
      });
      expect(screen.getByLabelText(EMPHASIZED_SERIES_DESCRIPTION)).toHaveTextContent('test_series_1');

      // Where a fast move lands: on the tooltip, or anything else that is not this chart's canvas.
      act(() => {
        fireEvent.mouseMove(document.body, { clientX: 300, clientY: 50 });
        jest.advanceTimersByTime(FRAME_MS);
      });

      expect(screen.queryByText('test_series_1')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('should hide the tooltip when the page scrolls after the selected series changed', () => {
    jest.useFakeTimers();

    try {
      const pointActions = [{ label: 'Test action', onClick: jest.fn() }];
      mockNearbySeriesByCursorX();
      const { canvas, chartRef } = renderChartCanvas();
      render(tooltipElement({ chartRef, pinnedPos: null, pointActions }));

      act(() => {
        fireEvent.mouseMove(canvas, { clientX: 100, clientY: 50 });
      });
      act(() => {
        fireEvent.mouseMove(canvas, { clientX: 200, clientY: 50 });
        jest.advanceTimersByTime(FRAME_MS);
      });
      act(() => {
        fireEvent.scroll(window);
      });

      expect(screen.queryByText('test_series_1')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('should keep the series selected at pin time when the data refreshes', () => {
    const onClick = jest.fn();
    const pointActions = [{ label: 'Test action', onClick }];
    (getNearbySeriesData as jest.Mock).mockReturnValue(buildNearbySeries(0));
    const { chartRef, rerender } = renderPinnedAfterHover(pointActions);

    // The refreshed data has another series closest to the pin.
    (getNearbySeriesData as jest.Mock).mockReturnValue(buildNearbySeries(1));
    rerender(tooltipElement({ chartRef, pinnedPos: PIN_POSITION, pointActions, data: [...TEST_DATA] }));
    userEvent.click(screen.getByRole('menuitem', { name: 'Test action' }));

    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ seriesName: 'test_series_0' }));
  });

  it('should drill into the series clicked on a pinned tooltip', () => {
    const onClick = jest.fn();
    (getNearbySeriesData as jest.Mock).mockReturnValue(buildNearbySeries(0));
    renderPinnedAfterHover([{ label: 'Test action', onClick }]);

    userEvent.click(screen.getByText('test_series_1'));
    userEvent.click(screen.getByRole('menuitem', { name: 'Test action' }));

    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ seriesName: 'test_series_1' }));
  });

  it('should ask to select a series when the selected one is clicked again on a pinned tooltip', () => {
    (getNearbySeriesData as jest.Mock).mockReturnValue(buildNearbySeries(0));
    renderPinnedAfterHover([{ label: 'Test action', onClick: jest.fn() }]);

    userEvent.click(screen.getByText('test_series_0'));

    expect(screen.getByText(SELECT_SERIES_HELP_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Test action' })).not.toBeInTheDocument();
  });

  it('should start from the closest series again when the tooltip is pinned somewhere else', () => {
    const onClick = jest.fn();
    const pointActions = [{ label: 'Test action', onClick }];
    (getNearbySeriesData as jest.Mock).mockReturnValue(buildNearbySeries(0));
    const { chartRef, rerender } = renderPinnedAfterHover(pointActions);

    userEvent.click(screen.getByText('test_series_1'));
    rerender(tooltipElement({ chartRef, pinnedPos: null, pointActions }));
    rerender(tooltipElement({ chartRef, pinnedPos: { ...PIN_POSITION, client: { x: 120, y: 50 } }, pointActions }));
    userEvent.click(screen.getByRole('menuitem', { name: 'Test action' }));

    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ seriesName: 'test_series_0' }));
  });
});
