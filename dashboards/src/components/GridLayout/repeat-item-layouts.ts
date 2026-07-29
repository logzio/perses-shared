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

// LOGZ.IO CHANGE START:: Item-level (single panel) repeat, mirroring Grafana's panel repeat

import { VariableStateMap } from '@perses-dev/plugin-system';
import { DEFAULT_MAX_PER_ROW, PanelGroupItemLayout, PanelGroupItemLayoutId, RepeatVariableBinding } from '../../model';
import { GRID_LAYOUT_COLS } from '../../constants';

const COLUMNS = GRID_LAYOUT_COLS.sm;

/**
 * Separator between an authored layout id and a repeat instance index. Instance ids must stay
 * distinct for react-grid-layout, and must be recognizable so a layout change reported for a
 * derived instance is never written back over the authored layout.
 */
const INSTANCE_ID_SEPARATOR = '::';

export interface RepeatedItemLayout extends PanelGroupItemLayout {
  /** Layout id of the authored item this instance was derived from. */
  sourceLayoutId: PanelGroupItemLayoutId;
  /** Variable name/value this instance is scoped to. Absent when the item does not repeat. */
  binding?: RepeatVariableBinding;
  /**
   * Position of this instance in the repeat, or absent when the item does not repeat. Index 0 is the
   * original: Grafana only offers edit/delete/duplicate there, since the rest are derived copies.
   */
  instanceIndex?: number;
}

export interface ExpandedItemLayouts {
  /** Instance layouts to hand to react-grid-layout, ordered top-to-bottom then left-to-right. */
  layouts: RepeatedItemLayout[];
  /**
   * Vertical shift applied to each authored item, keyed by its layout id. Subtracting this from a
   * reported y reverses the expansion, so drag/resize of a non-repeating neighbour can still be
   * persisted while repeats are in play.
   */
  yOffsets: Record<PanelGroupItemLayoutId, number>;
  /** True when at least one item expanded, i.e. some rendered geometry is derived rather than authored. */
  hasRepeats: boolean;
}

/**
 * True for a layout id produced by {@link expandRepeatedItemLayouts} rather than authored by a user.
 */
export function isRepeatInstanceId(layoutId: string): boolean {
  return layoutId.includes(INSTANCE_ID_SEPARATOR);
}

/**
 * Resolve the values a repeat variable currently expands to.
 *
 * Returns `undefined` when the variable is unknown, still loading, or has no value — callers then
 * render the item as authored rather than repeating over a value that is about to change.
 */
function resolveRepeatValues(variables: VariableStateMap, name: string): string[] | undefined {
  const state = variables[name];
  if (state === undefined || state.loading) {
    return undefined;
  }

  const { value } = state;
  if (value === null || value === undefined) {
    return undefined;
  }

  const values = (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === 'string');

  return values.length > 0 ? values : undefined;
}

/**
 * Ported from Grafana's `isOnTheSameGridRow`: a panel sitting to the right of a *vertically*
 * repeated panel shares its grid row and must not be pushed down with the panels below.
 * Horizontal repeats claim the full row, so nothing is exempt.
 */
function isOnTheSameGridRow(source: PanelGroupItemLayout, other: PanelGroupItemLayout): boolean {
  if (source.repeatDirection !== 'v') {
    return false;
  }

  return other.x >= source.x + source.w && other.y === source.y;
}

interface AppliedRepeat {
  source: PanelGroupItemLayout;
  /** Extra height the expansion added below the item's authored bottom edge. */
  delta: number;
}

/**
 * Expand grid items that carry a repeat variable into one instance per variable value, positioning
 * them the way Grafana does.
 *
 * Horizontal repeats fill the grid row — each instance is `max(cols / count, cols / maxPerRow)` wide
 * and wraps after `min(count, maxPerRow)` instances. Vertical repeats keep the authored width and
 * stack. Either way the items underneath are pushed down by the height the expansion added.
 *
 * Non-repeating items pass through untouched apart from that shift, so a group can freely mix
 * repeating and static panels.
 *
 * Deliberate divergence from Grafana: Grafana's packing loop advances its y cursor once more after
 * placing the final instance, over-reporting the shift by one item height; it gets away with it
 * because the grid compacts vertically afterwards. We compute the exact number of lines instead.
 */
export function expandRepeatedItemLayouts(
  itemLayouts: PanelGroupItemLayout[],
  variables: VariableStateMap
): ExpandedItemLayouts {
  const sorted = [...itemLayouts].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

  const layouts: RepeatedItemLayout[] = [];
  const yOffsets: Record<PanelGroupItemLayoutId, number> = {};
  const applied: AppliedRepeat[] = [];
  let hasRepeats = false;

  for (const item of sorted) {
    const offset = applied.reduce(
      (total, { source, delta }) => (isOnTheSameGridRow(source, item) ? total : total + delta),
      0
    );

    yOffsets[item.i] = offset;

    const values = item.repeatVariable ? resolveRepeatValues(variables, item.repeatVariable) : undefined;

    if (item.repeatVariable === undefined || values === undefined) {
      layouts.push({ ...item, y: item.y + offset, sourceLayoutId: item.i });
      continue;
    }

    hasRepeats = true;

    const repeatVariable = item.repeatVariable;
    const baseY = item.y + offset;
    const maxPerRow = item.maxPerRow && item.maxPerRow > 0 ? item.maxPerRow : DEFAULT_MAX_PER_ROW;
    // Grafana defaults an unset direction to horizontal.
    const isVertical = item.repeatDirection === 'v';
    const perLine = isVertical ? 1 : Math.min(values.length, maxPerRow);
    const width = isVertical ? item.w : Math.max(COLUMNS / values.length, COLUMNS / maxPerRow);

    values.forEach((value, index) => {
      const line = Math.floor(index / perLine);
      const column = index % perLine;

      layouts.push({
        ...item,
        i: `${item.i}${INSTANCE_ID_SEPARATOR}${index}`,
        sourceLayoutId: item.i,
        binding: [repeatVariable, value],
        instanceIndex: index,
        w: width,
        x: isVertical ? item.x : column * width,
        y: baseY + line * item.h,
      });
    });

    const lines = Math.ceil(values.length / perLine);
    applied.push({ source: item, delta: item.h * (lines - 1) });
  }

  return { layouts, yOffsets, hasRepeats };
}

// LOGZ.IO CHANGE END:: Item-level (single panel) repeat
