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

// LOGZ.IO CHANGE START:: Item-level repeat is edited in the panel editor but stored on the layout [APPZ-0000]

import { createStore, StoreApi } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { LayoutDefinition, PanelDefinition } from '@perses-dev/spec';
import { PanelGroupItemLayout } from '../../model';
import { createPanelGroupSlice, PanelGroupSlice } from './panel-group-slice';
import { createPanelEditorSlice, PanelEditorSlice } from './panel-editor-slice';
import { createPanelSlice, PanelSlice } from './panel-slice';

const panels: Record<string, PanelDefinition> = {
  disk: {
    kind: 'Panel',
    spec: { display: { name: 'Disk Utilization' }, plugin: { kind: 'TimeSeriesChart', spec: {} }, queries: [] },
  },
};

/** `repeat` is not in `@perses-dev/spec`'s item type — see RepeatableGridItemDefinition. */
type GridItem = LayoutDefinition['spec']['items'][number];

const buildLayouts = (repeat: Record<string, unknown> = {}): LayoutDefinition[] => [
  {
    kind: 'Grid',
    spec: {
      display: { title: 'Host stats', collapse: { open: true } },
      items: [{ x: 0, y: 0, width: 12, height: 7, content: { $ref: '#/spec/panels/disk' }, ...repeat } as GridItem],
    },
  },
  {
    kind: 'Grid',
    spec: { display: { title: 'Elsewhere', collapse: { open: true } }, items: [] },
  },
];

/** An imported dashboard whose panel already repeats, as the Grafana convertor emits it. */
const REPEATING = { repeatVariable: 'cluster', repeatDirection: 'v', maxPerRow: 3 };

type Store = PanelEditorSlice & PanelSlice & PanelGroupSlice;

const makeStore = (layouts: LayoutDefinition[] = buildLayouts()): StoreApi<Store> =>
  createStore<Store>()(
    immer(
      devtools((...args) => ({
        ...createPanelGroupSlice(layouts)(...args),
        ...createPanelSlice(panels)(...args),
        ...createPanelEditorSlice()(...args),
      }))
    )
  );

const firstItem = (store: StoreApi<Store>, groupIndex = 0): PanelGroupItemLayout | undefined => {
  const groupId = store.getState().panelGroupOrder[groupIndex];

  return store.getState().panelGroups[groupId!]?.itemLayouts[0];
};

const openEditor = (store: StoreApi<Store>): Store['panelEditor'] => {
  const groupId = store.getState().panelGroupOrder[0]!;
  const layoutId = store.getState().panelGroups[groupId]!.itemLayouts[0]!.i;

  store.getState().openEditPanel({ panelGroupId: groupId, panelGroupItemLayoutId: layoutId });

  return store.getState().panelEditor;
};

describe('panel editor item-level repeat', () => {
  it('should seed the editor with the repeat authored on the grid item', () => {
    const store = makeStore(buildLayouts(REPEATING));

    expect(openEditor(store)?.initialValues.repeat).toEqual(REPEATING);
  });

  it('should seed an empty repeat for a panel that does not repeat', () => {
    const store = makeStore();

    expect(openEditor(store)?.initialValues.repeat).toEqual({
      repeatVariable: undefined,
      repeatDirection: undefined,
      maxPerRow: undefined,
    });
  });

  it('should save a repeat configured in the editor onto the grid item', () => {
    const store = makeStore();
    const editor = openEditor(store);

    editor!.applyChanges({
      ...editor!.initialValues,
      repeat: { repeatVariable: 'cluster', repeatDirection: 'h', maxPerRow: 6 },
    });

    expect(firstItem(store)).toMatchObject({ repeatVariable: 'cluster', repeatDirection: 'h', maxPerRow: 6 });
  });

  it('should clear direction and maxPerRow when the repeat variable is set back to None', () => {
    const store = makeStore(buildLayouts(REPEATING));
    const editor = openEditor(store);

    // "None" submits an empty string rather than undefined.
    editor!.applyChanges({
      ...editor!.initialValues,
      repeat: { repeatVariable: '', repeatDirection: 'v', maxPerRow: 3 },
    });

    expect(firstItem(store)).toMatchObject({
      repeatVariable: undefined,
      repeatDirection: undefined,
      maxPerRow: undefined,
    });
  });

  it('should keep the repeat when the panel is moved to another group', () => {
    const store = makeStore();
    const targetGroupId = store.getState().panelGroupOrder[1]!;
    const editor = openEditor(store);

    editor!.applyChanges({
      ...editor!.initialValues,
      groupId: targetGroupId,
      repeat: { repeatVariable: 'cluster', repeatDirection: 'v' },
    });

    expect(firstItem(store, 0)).toBeUndefined();
    expect(firstItem(store, 1)).toMatchObject({ repeatVariable: 'cluster', repeatDirection: 'v' });
  });
});

// LOGZ.IO CHANGE END:: Item-level repeat [APPZ-0000]
