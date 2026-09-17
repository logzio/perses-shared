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

// LOGZ.IO ADDITION:: share the crosshair by timestamp, not echarts `connect`.
// `connect` forwards seriesIndex+dataIndex; a gap at that index hides the line on the receiver.

import { ECharts as EChartsInstance } from 'echarts/core';
import { getGridRect } from '../utils/chart-actions';

export interface AxisPointerEvent {
  axesInfo?: Array<{ axisDim?: string; value?: number }>;
}

function getHoveredTimeMs(event: unknown): number | undefined {
  const axesInfo = (event as AxisPointerEvent | null)?.axesInfo;
  if (!Array.isArray(axesInfo)) return undefined;

  const value = axesInfo.find((axis) => axis.axisDim !== 'y')?.value;

  return typeof value === 'number' ? value : undefined;
}

export type CrosshairAction =
  | { type: 'updateAxisPointer'; x: number; y: number }
  | { type: 'updateAxisPointer'; currTrigger: 'leave' };

export interface JoinCrosshairGroupOptions {
  chart: EChartsInstance;
  group: string;
}

const groups = new Map<string, Set<EChartsInstance>>();
const lastAction = new WeakMap<EChartsInstance, CrosshairAction>();

// echarts re-emits `updateAxisPointer` on every chart we dispatch to; those echoes look like hovers.
let isBroadcasting = false;

function isSameAction(previous: CrosshairAction | undefined, next: CrosshairAction): boolean {
  if (previous === undefined) return false;
  if ('currTrigger' in next) return 'currTrigger' in previous;

  return 'x' in previous && previous.x === next.x && previous.y === next.y;
}

function dispatchCrosshair(chart: EChartsInstance, action: CrosshairAction): void {
  // Same timestamp on a vertical mouse move still fires updateAxisPointer; skip the extra paint.
  if (isSameAction(lastAction.get(chart), action)) return;

  lastAction.set(chart, action);
  chart.dispatchAction(action);
}

function showCrosshair(chart: EChartsInstance, timeMs: number): void {
  const rect = getGridRect(chart);

  if (rect === undefined) return;

  const x = chart.convertToPixel({ xAxisIndex: 0 }, timeMs);

  if (typeof x !== 'number') return;

  dispatchCrosshair(chart, {
    type: 'updateAxisPointer',
    x,
    // Mid-grid: echarts ignores an updateAxisPointer whose point is outside the plot.
    y: rect.y + rect.height / 2,
  });
}

function hideCrosshair(chart: EChartsInstance): void {
  dispatchCrosshair(chart, { type: 'updateAxisPointer', currTrigger: 'leave' });
}

export function joinCrosshairGroup({ chart, group }: JoinCrosshairGroupOptions): () => void {
  const members = groups.get(group) ?? new Set<EChartsInstance>();

  groups.set(group, members);
  members.add(chart);

  const handleAxisPointer = (event: unknown): void => {
    if (isBroadcasting) return;

    const timeMs = getHoveredTimeMs(event);

    isBroadcasting = true;

    try {
      members.forEach((member) => {
        if (member === chart || member.isDisposed()) return;

        if (timeMs === undefined) {
          hideCrosshair(member);
          return;
        }

        showCrosshair(member, timeMs);
      });
    } finally {
      isBroadcasting = false;
    }
  };

  chart.on('updateAxisPointer', handleAxisPointer);

  return (): void => {
    chart.off('updateAxisPointer', handleAxisPointer);
    members.delete(chart);
    lastAction.delete(chart);

    if (members.size === 0) groups.delete(group);
  };
}
