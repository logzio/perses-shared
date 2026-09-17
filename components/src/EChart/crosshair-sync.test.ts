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

// LOGZ.IO ADDITION:: timestamp-based shared crosshair

import { ECharts as EChartsInstance } from 'echarts/core';
import { GridRect } from '../utils/chart-actions';
import { AxisPointerEvent, CrosshairAction, joinCrosshairGroup } from './crosshair-sync';

interface FakeChart {
  dispatched: unknown[];
  isDisposed: () => boolean;
  dispatchAction: (payload: CrosshairAction) => void;
  convertToPixel: (finder: unknown, value: number) => number;
  _model: { getComponent: (mainType: string) => { coordinateSystem: { getRect: () => GridRect } } | undefined };
  on: (eventName: string, handler: (event: AxisPointerEvent) => void) => void;
  off: (eventName: string) => void;
  hover: (timeMs: number | undefined) => void;
  emit: (event: AxisPointerEvent) => void;
}

interface FakeChartOptions {
  pixelsPerMs?: number;
  gridTop?: number;
  gridHeight?: number;
  gridRect?: null;
  disposed?: boolean;
}

function createFakeChart({
  pixelsPerMs = 1,
  gridTop = 20,
  gridHeight = 100,
  gridRect,
  disposed = false,
}: FakeChartOptions = {}): FakeChart {
  const dispatched: unknown[] = [];
  const handlers = new Map<string, (event: AxisPointerEvent) => void>();

  const emit = (event: AxisPointerEvent): void => {
    handlers.get('updateAxisPointer')?.(event);
  };

  return {
    dispatched,
    isDisposed: (): boolean => disposed,
    dispatchAction: (payload): void => {
      dispatched.push(payload);
      emit({
        axesInfo: 'x' in payload ? [{ axisDim: 'x', value: payload.x / pixelsPerMs }] : [],
      });
    },
    convertToPixel: (_finder, value): number => value * pixelsPerMs,
    _model: {
      getComponent: () =>
        gridRect === null
          ? undefined
          : { coordinateSystem: { getRect: (): GridRect => ({ x: 0, y: gridTop, width: 400, height: gridHeight }) } },
    },
    on: (eventName, handler): void => {
      handlers.set(eventName, handler);
    },
    off: (eventName): void => {
      handlers.delete(eventName);
    },
    emit,
    hover: (timeMs): void => {
      emit({ axesInfo: timeMs === undefined ? [] : [{ axisDim: 'x', value: timeMs }] });
    },
  };
}

function join(chart: FakeChart, group: string): () => void {
  return joinCrosshairGroup({ chart: chart as unknown as EChartsInstance, group });
}

describe('joinCrosshairGroup', () => {
  it('should place the crosshair at each chart own pixel position for the hovered timestamp', () => {
    const hovered = createFakeChart({ pixelsPerMs: 1 });
    const peer = createFakeChart({ pixelsPerMs: 2, gridTop: 20, gridHeight: 100 });

    join(hovered, 'group-pixel-position');
    join(peer, 'group-pixel-position');

    hovered.hover(1000);

    expect(peer.dispatched).toEqual([{ type: 'updateAxisPointer', x: 2000, y: 70 }]);
  });

  it('should read the timestamp from the x axis when axesInfo also includes a y axis', () => {
    const hovered = createFakeChart({ pixelsPerMs: 1 });
    const peer = createFakeChart({ pixelsPerMs: 1, gridTop: 20, gridHeight: 100 });

    join(hovered, 'group-x-axis');
    join(peer, 'group-x-axis');

    hovered.emit({
      axesInfo: [
        { axisDim: 'y', value: 50 },
        { axisDim: 'x', value: 1000 },
      ],
    });

    expect(peer.dispatched).toEqual([{ type: 'updateAxisPointer', x: 1000, y: 70 }]);
  });

  it('should hide the crosshair on the other charts when the pointer leaves the hovered chart', () => {
    const hovered = createFakeChart();
    const peer = createFakeChart();

    join(hovered, 'group-pointer-leave');
    join(peer, 'group-pointer-leave');

    hovered.hover(undefined);

    expect(peer.dispatched).toEqual([{ type: 'updateAxisPointer', currTrigger: 'leave' }]);
  });

  it('should not bounce the crosshair back to the chart the broadcast came from', () => {
    const hovered = createFakeChart({ pixelsPerMs: 1 });
    const peer = createFakeChart({ pixelsPerMs: 2 });

    join(hovered, 'group-no-echo');
    join(peer, 'group-no-echo');

    hovered.hover(1000);

    expect(peer.dispatched).toHaveLength(1);
    expect(hovered.dispatched).toHaveLength(0);
  });

  it('should not re-dispatch when the pointer stays at the same timestamp', () => {
    const hovered = createFakeChart();
    const peer = createFakeChart();

    join(hovered, 'group-same-timestamp');
    join(peer, 'group-same-timestamp');

    hovered.hover(1000);
    hovered.hover(1000);

    expect(peer.dispatched).toHaveLength(1);
  });

  it('should stop broadcasting to a chart once it has left the group', () => {
    const hovered = createFakeChart();
    const peer = createFakeChart();

    join(hovered, 'group-leaver');
    const leave = join(peer, 'group-leaver');

    leave();
    hovered.hover(1000);

    expect(peer.dispatched).toHaveLength(0);
  });

  it('should keep broadcasting to the rest of the group when a chart has no grid to place the crosshair in', () => {
    const hovered = createFakeChart();
    const gridless = createFakeChart({ gridRect: null });
    const peer = createFakeChart();

    join(hovered, 'group-gridless');
    join(gridless, 'group-gridless');
    join(peer, 'group-gridless');

    hovered.hover(1000);

    expect(gridless.dispatched).toHaveLength(0);
    expect(peer.dispatched).toHaveLength(1);
  });

  it('should not dispatch to a chart that has already been disposed', () => {
    const hovered = createFakeChart();
    const disposed = createFakeChart({ disposed: true });

    join(hovered, 'group-disposed');
    join(disposed, 'group-disposed');

    hovered.hover(1000);

    expect(disposed.dispatched).toHaveLength(0);
  });
});
