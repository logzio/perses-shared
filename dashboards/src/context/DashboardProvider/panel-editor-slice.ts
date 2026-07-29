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

import { Action } from '@perses-dev/components';
import { PanelEditorValues, PanelGroupId } from '@perses-dev/spec';
import { StateCreator } from 'zustand';
import { generatePanelKey, getYForNewRow } from '../../utils';
import {
  GridItemRepeatOptions,
  PanelGroupDefinition,
  PanelGroupItemId,
  PanelGroupItemLayout,
  RepeatablePanelEditorValues,
} from '../../model';
import { generateId, Middleware, createPanelDefinition } from './common';
import { PanelGroupSlice, addPanelGroup, createEmptyPanelGroup } from './panel-group-slice';
import { PanelSlice } from './panel-slice';

/**
 * Slice that handles the visual editor state and actions for adding or editing Panels.
 */
export interface PanelEditorSlice {
  /**
   * Initial values for add panel if default panel kind is defined
   */
  initialValues?: Pick<PanelEditorValues, 'panelDefinition'>;

  /**
   * State for the panel editor when its open, otherwise undefined when it's closed.
   */
  panelEditor?: PanelEditorState;

  /**
   * Opens the editor for editing an existing panel by providing its layout coordinates.
   */
  openEditPanel: (panelGroupItemId: PanelGroupItemId) => void;

  /**
   * Opens the editor for adding a new Panel to a panel group.
   */
  openAddPanel: (panelGroupId?: PanelGroupId, panelDefinition?: PanelEditorValues['panelDefinition']) => void; // LOGZ.IO CHANGE START:: APPZ-1234 add panelDefinition parameter
}

export interface PanelEditorState {
  /**
   * Whether we're adding a new panel, or editing an existing panel.
   */
  mode: Action;

  /*
   * Original item in a PanelGroup edited
   */
  panelGroupItemId?: PanelGroupItemId;

  /**
   * Initial values for the things that can be edited about a panel.
   */
  // LOGZ.IO CHANGE:: Carries the grid item's repeat options alongside the panel [APPZ-0000]
  initialValues: RepeatablePanelEditorValues;

  /**
   * Applies changes, but doesn't close the editor.
   */
  applyChanges: (next: RepeatablePanelEditorValues) => void;

  /**
   * Close the editor.
   */
  close: () => void;
}

// LOGZ.IO CHANGE START:: Item-level repeat is stored on the grid item layout [APPZ-0000]
/**
 * Write the editor's repeat options onto a grid item layout.
 *
 * Direction and max-per-row only mean anything alongside a variable, so clearing the variable clears
 * them too — otherwise turning a repeat off would leave orphaned fields in the saved dashboard.
 */
function applyItemRepeat(layout: PanelGroupItemLayout | undefined, repeat?: GridItemRepeatOptions): void {
  if (layout === undefined) {
    return;
  }

  // An empty string is what the "None" option in the editor submits.
  layout.repeatVariable = repeat?.repeatVariable || undefined;
  layout.repeatDirection = layout.repeatVariable ? repeat?.repeatDirection : undefined;
  layout.maxPerRow = layout.repeatVariable ? repeat?.maxPerRow : undefined;
}
// LOGZ.IO CHANGE END:: Item-level repeat is stored on the grid item layout [APPZ-0000]

/**
 * Curried function for creating the PanelEditorSlice.
 */
export function createPanelEditorSlice(): StateCreator<
  // Actions in here need to modify both Panels and Panel Groups state
  PanelEditorSlice & PanelSlice & PanelGroupSlice,
  Middleware,
  [],
  PanelEditorSlice
> {
  // Return the state creator function for Zustand that uses the panels provided as intitial state
  return (set, get) => ({
    panelEditor: undefined,

    openEditPanel(panelGroupItemId): void {
      const { panels, panelGroups } = get();

      // Figure out the panel key at that location
      const { panelGroupId, panelGroupItemLayoutId: panelGroupLayoutId } = panelGroupItemId;
      const panelKey = panelGroups[panelGroupId]?.itemPanelKeys[panelGroupLayoutId];
      if (panelKey === undefined) {
        throw new Error(`Could not find Panel Group item ${panelGroupItemId}`);
      }

      // Find the panel to edit
      const panelToEdit = panels[panelKey];
      if (panelToEdit === undefined) {
        throw new Error(`Cannot find Panel with key '${panelKey}'`);
      }

      // LOGZ.IO CHANGE:: Item-level repeat is authored on the grid item, so seed it from there [APPZ-0000]
      const layoutToEdit = panelGroups[panelGroupId]?.itemLayouts.find((layout) => layout.i === panelGroupLayoutId);

      const editorState: PanelEditorState = {
        mode: 'update',
        panelGroupItemId: panelGroupItemId,
        initialValues: {
          groupId: panelGroupItemId.panelGroupId,
          panelDefinition: panelToEdit,
          // LOGZ.IO CHANGE:: Item-level repeat [APPZ-0000]
          repeat: {
            repeatVariable: layoutToEdit?.repeatVariable,
            repeatDirection: layoutToEdit?.repeatDirection,
            maxPerRow: layoutToEdit?.maxPerRow,
          },
        },
        applyChanges: (next) => {
          set((state) => {
            state.panels[panelKey] = next.panelDefinition;

            // If the panel didn't change groups, nothing else to do
            if (next.groupId === panelGroupId) {
              // LOGZ.IO CHANGE:: ...apart from the repeat, which lives on the layout [APPZ-0000]
              applyItemRepeat(
                state.panelGroups[panelGroupId]?.itemLayouts.find((layout) => layout.i === panelGroupLayoutId),
                next.repeat
              );
              return;
            }

            // Move panel to the new group
            const existingGroup = state.panelGroups[panelGroupId];
            if (existingGroup === undefined) {
              throw new Error(`Missing panel group ${panelGroupId}`);
            }

            const existingLayoutIdx = existingGroup.itemLayouts.findIndex((layout) => layout.i === panelGroupLayoutId);
            const existingLayout = existingGroup.itemLayouts[existingLayoutIdx];
            const existingPanelKey = existingGroup.itemPanelKeys[panelGroupLayoutId];
            if (existingLayoutIdx === -1 || existingLayout === undefined || existingPanelKey === undefined) {
              throw new Error(`Missing panel group item ${panelGroupLayoutId}`);
            }

            // Remove item from the old group
            existingGroup.itemLayouts.splice(existingLayoutIdx, 1);
            delete existingGroup.itemPanelKeys[panelGroupLayoutId];

            // Add item to the end of the new group
            const newGroup = state.panelGroups[next.groupId];
            if (newGroup === undefined) {
              throw new Error(`Could not find new group ${next.groupId}`);
            }

            const movedLayout: PanelGroupItemLayout = {
              i: existingLayout.i,
              x: 0,
              y: getYForNewRow(newGroup),
              w: existingLayout.w,
              h: existingLayout.h,
            };
            // LOGZ.IO CHANGE:: The rebuild above drops every field it doesn't list, repeat included [APPZ-0000]
            applyItemRepeat(movedLayout, next.repeat);

            newGroup.itemLayouts.push(movedLayout);
            newGroup.itemPanelKeys[existingLayout.i] = existingPanelKey;
          });
        },
        close: () => {
          set((state) => {
            state.panelEditor = undefined;
          });
        },
      };

      // Open the editor with the new state
      set((state) => {
        state.panelEditor = editorState;
      });
    },

    openAddPanel(panelGroupId, panelDefinition): void {
      // LOGZ.IO CHANGE:: APPZ-1234 add panelDefinition parameter
      // If a panel group isn't supplied, add to the first group or create a group if there aren't any
      let newGroup: PanelGroupDefinition | undefined = undefined;
      panelGroupId ??= get().panelGroupOrder[0];
      if (panelGroupId === undefined) {
        newGroup = createEmptyPanelGroup();
        newGroup.title = 'Panel Group';
        panelGroupId = newGroup.id;
      }

      const editorState: PanelEditorState = {
        mode: 'create',
        initialValues: {
          groupId: panelGroupId,
          panelDefinition: panelDefinition ?? get().initialValues?.panelDefinition ?? createPanelDefinition(), // LOGZ.IO CHANGE:: APPZ-1234 add panelDefinition parameter
        },
        applyChanges: (next) => {
          const panelKey = generatePanelKey();
          set((state) => {
            // Add a panel
            state.panels[panelKey] = next.panelDefinition;

            // Also add a panel group item referencing the panel
            const group = state.panelGroups[next.groupId];
            if (group === undefined) {
              throw new Error(`Missing panel group ${next.groupId}`);
            }
            const layout: PanelGroupItemLayout = {
              i: generateId().toString(),
              x: 0,
              y: getYForNewRow(group),
              w: 12,
              h: 6,
            };
            // LOGZ.IO CHANGE:: A panel can be created with its repeat already configured [APPZ-0000]
            applyItemRepeat(layout, next.repeat);

            group.itemLayouts.push(layout);
            group.itemPanelKeys[layout.i] = panelKey;
          });
        },
        close: () => {
          set((state) => {
            state.panelEditor = undefined;
          });
        },
      };

      set((state) => {
        // Add the new panel group if one was created for the panel
        if (newGroup !== undefined) {
          addPanelGroup(state, newGroup);
        }

        // Open the editor with the new state
        state.panelEditor = editorState;
      });
    },
  });
}
