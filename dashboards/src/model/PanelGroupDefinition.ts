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

import { GridItemDefinition, PanelEditorValues } from '@perses-dev/spec';

export type PanelGroupId = number;

/**
 * Panel Group Item Layout ID type. String identifier for items within a panel group.
 */
export type PanelGroupItemLayoutId = string;

/**
 * Binding of a repeat variable to one of its values, scoping a single repeated instance.
 */
export type RepeatVariableBinding = [string, string];

// LOGZ.IO CHANGE START:: Item-level (single panel) repeat, mirroring Grafana's panel repeat [APPZ-0000]
/**
 * Direction repeated items are laid out in. Mirrors Grafana's `repeatDirection`:
 * `h` packs instances side by side (wrapping at `maxPerRow`), `v` stacks them.
 */
export type RepeatDirection = 'h' | 'v';

/**
 * Repeat configuration carried by a single grid item, as opposed to {@link PanelGroupDefinition.repeatVariable}
 * which repeats the whole group. Field names and semantics deliberately match Grafana so dashboard
 * conversion is a direct copy.
 */
export interface GridItemRepeatOptions {
  /** Name of the variable to repeat this item over. */
  repeatVariable?: string;
  /** Defaults to `h`, matching Grafana. Ignored unless `repeatVariable` is set. */
  repeatDirection?: RepeatDirection;
  /** Max instances per grid row. Defaults to {@link DEFAULT_MAX_PER_ROW}. Only honored when direction is `h`. */
  maxPerRow?: number;
}
// LOGZ.IO CHANGE END:: Item-level (single panel) repeat [APPZ-0000]

/**
 * Uniquely identifies an item in a PanelGroup.
 */
export interface PanelGroupItemId {
  panelGroupId: PanelGroupId;
  panelGroupItemLayoutId: PanelGroupItemLayoutId;
  repeatVariable?: RepeatVariableBinding; // Optional, used for repeated panel groups. Variable name and value.
  // LOGZ.IO CHANGE:: Set for a single repeated grid item; independent of the group-level binding above [APPZ-0000]
  itemRepeatVariable?: RepeatVariableBinding;
}

/**
 * Base layout properties for positioning and sizing items in a grid.
 * This is a framework-agnostic representation that can be used with various grid systems.
 */
export interface BaseLayout {
  /**
   * Item identifier
   */
  i: string;
  /**
   * X position in grid units
   */
  x: number;
  /**
   * Y position in grid units
   */
  y: number;
  /**
   * Width in grid units
   */
  w: number;
  /**
   * Height in grid units
   */
  h: number;
}

export interface PanelGroupItemLayout extends BaseLayout, GridItemRepeatOptions {
  i: PanelGroupItemLayoutId;
}

// LOGZ.IO CHANGE START:: Item-level repeat is not in @perses-dev/spec's GridItemDefinition yet [APPZ-0000]
/**
 * `GridItemDefinition` plus item-level repeat. Kept as a named extension instead of patching
 * `@perses-dev/spec` so the fields survive spec version bumps.
 */
export interface RepeatableGridItemDefinition extends GridItemDefinition, GridItemRepeatOptions {}

/** Grafana's default when `maxPerRow` is unset on a horizontally repeated panel. */
export const DEFAULT_MAX_PER_ROW = 4;

/**
 * `PanelEditorValues` plus the item-level repeat the panel editor edits.
 *
 * Repeat rides alongside `panelDefinition` rather than inside it because it is authored on the grid
 * item layout, not the panel spec — the same kind of layout-level value as `groupId`, which the
 * editor already owns. One panel can be referenced by several grid items, so the repeat belongs to
 * the item being edited rather than to the panel itself.
 */
export interface RepeatablePanelEditorValues extends PanelEditorValues {
  repeat?: GridItemRepeatOptions;
}
// LOGZ.IO CHANGE END:: Item-level repeat [APPZ-0000]

/**
 * Definition of a panel group, containing layout and panel information.
 */
export interface PanelGroupDefinition {
  id: PanelGroupId;
  isCollapsed: boolean;
  title?: string;
  repeatedOriginId?: PanelGroupId; // ID of the original panel group from which this repeated group is derived
  repeatVariable?: string; // Optional, used for repeated panel groups
  itemLayouts: PanelGroupItemLayout[];
  itemPanelKeys: Record<PanelGroupItemLayoutId, string>;
}

/**
 * Check if two PanelGroupItemId are equal
 */
export function isPanelGroupItemIdEqual(a?: PanelGroupItemId, b?: PanelGroupItemId): boolean {
  return (
    a?.panelGroupId === b?.panelGroupId &&
    a?.panelGroupItemLayoutId === b?.panelGroupItemLayoutId &&
    // LOGZ.IO CHANGE:: Repeat instances share a layout id, so the bindings decide which one it is [APPZ-0000]
    isRepeatBindingEqual(a?.repeatVariable, b?.repeatVariable) &&
    isRepeatBindingEqual(a?.itemRepeatVariable, b?.itemRepeatVariable)
  );
}

// LOGZ.IO CHANGE START:: Item-level repeat [APPZ-0000]
/**
 * Two repeat bindings match when they pin the same variable to the same value. Absent on both
 * sides counts as a match, so non-repeated items compare as before.
 */
export function isRepeatBindingEqual(a?: RepeatVariableBinding, b?: RepeatVariableBinding): boolean {
  return a?.[0] === b?.[0] && a?.[1] === b?.[1];
}
// LOGZ.IO CHANGE END:: Item-level repeat [APPZ-0000]
