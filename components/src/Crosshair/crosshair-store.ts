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

// LOGZ.IO ADDITION:: shared crosshair position, replacing the ECharts connect group [unidash-perf]
// Charts used to share the crosshair through `echarts.connect`, which re-dispatches every
// axis-pointer update to every member on every raw pointer event; each member then repainted all of
// its series to move a one-pixel line. This store carries the hovered timestamp instead, so a chart
// can draw the crosshair as a DOM element the compositor moves.
//
// The value is a timestamp rather than a pixel offset on purpose: panels can sit at different widths
// and can carry a panel-level time-range override, so each subscriber converts the timestamp through
// its own x axis.

export interface SharedCrosshairPosition {
  timestampMs: number;
  /** Identity of the chart the cursor is actually over; only that chart may clear the position. */
  sourceId: string;
}

let position: SharedCrosshairPosition | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getSharedCrosshair(): SharedCrosshairPosition | null {
  return position;
}

export function setSharedCrosshair(next: SharedCrosshairPosition): void {
  if (position !== null && position.timestampMs === next.timestampMs && position.sourceId === next.sourceId) {
    return;
  }
  position = next;
  emit();
}

/**
 * Clears the crosshair, but only when it still belongs to `sourceId`. A cursor moving straight from
 * one panel onto the next reaches the new panel before the old one sees its leave event, and without
 * this guard the late leave would wipe the position the new panel had just published.
 */
export function clearSharedCrosshair(sourceId: string): void {
  if (position === null || position.sourceId !== sourceId) {
    return;
  }
  position = null;
  emit();
}

export function subscribeToSharedCrosshair(listener: () => void): () => void {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
}
