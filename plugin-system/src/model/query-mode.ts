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
// LOGZ.IO CHANGE START:: Panel-level "Instant query"
// The panel spec's `queryMode` asks its queries for one value per series over the whole range
// (`instant`) instead of a time series (`range`). It sits next to `maxDataPoints` and, like it, is read
// by the editor field (plugin-system) and the two places that build query options from a panel spec
// (dashboards). A plugin that fixes its own mode keeps it: the setting only fills the mode a plugin
// leaves open.

export type PanelQueryMode = 'range' | 'instant';

const PANEL_QUERY_MODES: ReadonlySet<string> = new Set<PanelQueryMode>(['range', 'instant']);

/**
 * The panel kinds the editor offers the switch on. A bar is one value per series by nature, so an
 * instant query is what it means. The other kinds are left for a pass of their own.
 */
const PANEL_KINDS_WITH_QUERY_MODE: ReadonlySet<string> = new Set(['BarChart']);

/**
 * Reads a panel spec's `queryMode`. Anything a hand-edited dashboard JSON could hold other than the
 * two modes resolves to `undefined`, which every caller reads as "let the panel plugin decide".
 */
export function resolvePanelQueryMode(queryMode: unknown): PanelQueryMode | undefined {
  return typeof queryMode === 'string' && PANEL_QUERY_MODES.has(queryMode) ? (queryMode as PanelQueryMode) : undefined;
}

export function supportsPanelQueryMode(panelKind: string): boolean {
  return PANEL_KINDS_WITH_QUERY_MODE.has(panelKind);
}

/**
 * The mode that applies to a panel: its stored `queryMode`, but only on a kind that offers the switch.
 * A value left behind when the visualization changed to another kind would otherwise keep running with
 * no control left to turn it off.
 */
export function resolveActivePanelQueryMode({
  panelKind,
  queryMode,
}: {
  panelKind: string;
  queryMode: unknown;
}): PanelQueryMode | undefined {
  return supportsPanelQueryMode(panelKind) ? resolvePanelQueryMode(queryMode) : undefined;
}
// LOGZ.IO CHANGE END:: Panel-level "Instant query"
