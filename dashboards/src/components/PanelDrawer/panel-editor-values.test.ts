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

import { PanelEditorValues, panelEditorSchema } from '@perses-dev/spec';
import { RepeatablePanelEditorValues } from '../../model';
import { hasUnsavedChanges, restoreValuesStrippedByValidation } from './panel-editor-values';

describe('restoreValuesStrippedByValidation', () => {
  // Mirrors the customer scenario: a hidden query referenced by a math expression query.
  const RAW_VALUES = {
    groupId: 0,
    panelDefinition: {
      kind: 'Panel',
      spec: {
        display: { name: 'JVM Non Heap Memory Used' },
        plugin: { kind: 'TimeSeriesChart', spec: {} },
        timeFrom: '1h',
        hideTimeOverride: false,
        queries: [
          {
            kind: 'TimeSeriesQuery',
            spec: {
              plugin: { kind: 'PrometheusTimeSeriesQuery', spec: { query: 'kube_pod_container_resource_limits' } },
              hidden: true,
            },
          },
          {
            kind: 'TimeSeriesQuery',
            spec: {
              plugin: {
                kind: 'ExpressionTimeSeriesQuery',
                spec: { type: 'math', math: { expression: '$1 - $2' }, query: '' },
              },
            },
          },
        ],
      },
    },
  } as unknown as PanelEditorValues;

  const getQuerySpec = (values: PanelEditorValues, index: number): { hidden?: boolean } | undefined =>
    values.panelDefinition.spec.queries?.[index]?.spec as { hidden?: boolean } | undefined;

  // Canary for the workaround itself: if this test starts failing, @perses-dev/spec learned the
  // Logz.io extension fields and restoreValuesStrippedByValidation can likely be removed.
  it('should strip query hidden and panel time override fields when validating with the @perses-dev/spec schema', () => {
    const validated = panelEditorSchema.parse(RAW_VALUES) as PanelEditorValues;

    expect(getQuerySpec(validated, 0)).toBeDefined();
    expect(getQuerySpec(validated, 0)).not.toHaveProperty('hidden');
    expect(validated.panelDefinition.spec).not.toHaveProperty('timeFrom');
    expect(validated.panelDefinition.spec).not.toHaveProperty('hideTimeOverride');
  });

  // Regression test for the "Hide from chart doesn't persist after Apply" bug: run the values
  // through the exact validate-then-restore pipeline processForm uses on submit.
  it('should persist the query hidden flag through validation when the query is hidden in the editor', () => {
    const validated = panelEditorSchema.parse(RAW_VALUES) as PanelEditorValues;

    const restored = restoreValuesStrippedByValidation(validated, RAW_VALUES);

    expect(getQuerySpec(restored, 0)?.hidden).toBe(true);
    // The untouched query must not get a `hidden` key invented for it
    expect(getQuerySpec(restored, 1)).not.toHaveProperty('hidden');
    // Restoring must not drop the validated query content
    expect(restored.panelDefinition.spec.queries?.[0]?.spec.plugin).toEqual(
      RAW_VALUES.panelDefinition.spec.queries?.[0]?.spec.plugin
    );
  });

  it('should restore an explicit hidden false when the query was re-enabled in the editor', () => {
    const raw = JSON.parse(JSON.stringify(RAW_VALUES)) as PanelEditorValues;
    (getQuerySpec(raw, 0) as { hidden?: boolean }).hidden = false;

    const restored = restoreValuesStrippedByValidation(panelEditorSchema.parse(raw) as PanelEditorValues, raw);

    expect(getQuerySpec(restored, 0)?.hidden).toBe(false);
  });

  it('should restore panel time override fields when present in the raw values', () => {
    const validated = panelEditorSchema.parse(RAW_VALUES) as PanelEditorValues;

    const restored = restoreValuesStrippedByValidation(validated, RAW_VALUES);
    const restoredSpec = restored.panelDefinition.spec as { timeFrom?: string; hideTimeOverride?: boolean };

    expect(restoredSpec.timeFrom).toBe('1h');
    expect(restoredSpec.hideTimeOverride).toBe(false);
  });

  // LOGZ.IO CHANGE START:: Item-level repeat rides alongside panelDefinition and is stripped too
  it('should strip the item-level repeat when validating with the @perses-dev/spec schema', () => {
    const raw = { ...RAW_VALUES, repeat: { repeatVariable: 'cluster', repeatDirection: 'v', maxPerRow: 3 } };

    expect(panelEditorSchema.parse(raw)).not.toHaveProperty('repeat');
  });

  it('should restore the item-level repeat configured in the editor', () => {
    const raw = {
      ...RAW_VALUES,
      repeat: { repeatVariable: 'cluster', repeatDirection: 'v' as const, maxPerRow: 3 },
    };

    const restored = restoreValuesStrippedByValidation(panelEditorSchema.parse(raw) as PanelEditorValues, raw);

    expect(restored.repeat).toEqual({ repeatVariable: 'cluster', repeatDirection: 'v', maxPerRow: 3 });
  });

  it('should restore a cleared repeat so turning it off reaches the store', () => {
    // "None" submits an empty variable; the store reads that as "no repeat" and clears the layout.
    const raw = { ...RAW_VALUES, repeat: { repeatVariable: '' } };

    const restored = restoreValuesStrippedByValidation(panelEditorSchema.parse(raw) as PanelEditorValues, raw);

    expect(restored.repeat).toEqual({ repeatVariable: '' });
  });

  it('should not invent a repeat for a panel that never had one', () => {
    const restored = restoreValuesStrippedByValidation(
      panelEditorSchema.parse(RAW_VALUES) as PanelEditorValues,
      RAW_VALUES
    );

    expect(restored).not.toHaveProperty('repeat');
  });
  // LOGZ.IO CHANGE END:: Item-level repeat

  it('should not restore empty-string time override fields when they were cleared in the editor', () => {
    const raw = JSON.parse(JSON.stringify(RAW_VALUES)) as PanelEditorValues;
    (raw.panelDefinition.spec as { timeFrom?: string }).timeFrom = '';

    const restored = restoreValuesStrippedByValidation(panelEditorSchema.parse(raw) as PanelEditorValues, raw);

    expect(restored.panelDefinition.spec).not.toHaveProperty('timeFrom');
  });

  it('should return the validated values unchanged when the raw values contain no extension fields', () => {
    const raw = {
      groupId: 0,
      panelDefinition: {
        kind: 'Panel',
        spec: {
          plugin: { kind: 'Markdown', spec: { text: 'hello' } },
        },
      },
    } as unknown as PanelEditorValues;
    const validated = panelEditorSchema.parse(raw) as PanelEditorValues;

    const restored = restoreValuesStrippedByValidation(validated, raw);

    expect(restored).toEqual(validated);
    expect(restored.panelDefinition.spec.queries).toBeUndefined();
  });
});

// LOGZ.IO CHANGE START:: unsaved-changes comparison [APPZ-302]
describe('hasUnsavedChanges', () => {
  const buildValues = (overrides: Partial<RepeatablePanelEditorValues> = {}): RepeatablePanelEditorValues =>
    ({
      groupId: 0,
      panelDefinition: {
        kind: 'Panel',
        spec: {
          display: { name: 'Test Panel 3' },
          plugin: { kind: 'TimeSeriesChart', spec: {} },
        },
      },
      ...overrides,
    }) as unknown as RepeatablePanelEditorValues;

  it('should report no changes when nothing was edited', () => {
    expect(hasUnsavedChanges(buildValues(), buildValues())).toBe(false);
  });

  it('should report a change when the panel name was edited', () => {
    const edited = buildValues();

    edited.panelDefinition.spec.display = { name: 'Renamed' };

    expect(hasUnsavedChanges(buildValues(), edited)).toBe(true);
  });

  // Regression: `create` mode seeds `initialValues` without a `repeat` key, but RepeatOptionsEditor
  // registers `repeat.*` with react-hook-form, so `getValues()` materializes the object. Comparing
  // them raw made every untouched "Add Panel" read as dirty, so Cancel raised "Discard Changes" and
  // the drawer never closed.
  it('should report no changes when the repeat object was only materialized by the form', () => {
    const initial = buildValues();
    const current = buildValues({
      repeat: { repeatVariable: undefined, repeatDirection: undefined, maxPerRow: undefined },
    });

    expect(initial.repeat).toBeUndefined();
    expect(hasUnsavedChanges(initial, current)).toBe(false);
  });

  it('should report no changes when the repeat variable is the empty string the "None" option submits', () => {
    const initial = buildValues({ repeat: { repeatVariable: undefined } });
    const current = buildValues({ repeat: { repeatVariable: '' } });

    expect(hasUnsavedChanges(initial, current)).toBe(false);
  });

  it('should report no changes when direction and max-per-row linger without a repeat variable', () => {
    const initial = buildValues();
    const current = buildValues({ repeat: { repeatVariable: '', repeatDirection: 'h', maxPerRow: 4 } });

    expect(hasUnsavedChanges(initial, current)).toBe(false);
  });

  it('should report a change when a repeat variable was picked', () => {
    const initial = buildValues({ repeat: { repeatVariable: undefined } });
    const current = buildValues({ repeat: { repeatVariable: 'cluster' } });

    expect(hasUnsavedChanges(initial, current)).toBe(true);
  });

  it('should report a change when an existing repeat variable was cleared', () => {
    const initial = buildValues({ repeat: { repeatVariable: 'cluster' } });
    const current = buildValues({ repeat: { repeatVariable: '' } });

    expect(hasUnsavedChanges(initial, current)).toBe(true);
  });

  it('should report a change when the direction of an active repeat was edited', () => {
    const initial = buildValues({ repeat: { repeatVariable: 'cluster', repeatDirection: 'h' } });
    const current = buildValues({ repeat: { repeatVariable: 'cluster', repeatDirection: 'v' } });

    expect(hasUnsavedChanges(initial, current)).toBe(true);
  });

  it('should treat an absent display as equal to one with neither name nor description', () => {
    const initial = buildValues();
    const current = buildValues();

    initial.panelDefinition.spec.display = undefined;
    current.panelDefinition.spec.display = { name: undefined, description: undefined } as unknown as {
      name: string;
    };

    expect(hasUnsavedChanges(initial, current)).toBe(false);
  });

  it('should not mutate the values it is given', () => {
    const current = buildValues({ repeat: { repeatVariable: '' } });

    hasUnsavedChanges(buildValues(), current);

    expect(current.repeat).toEqual({ repeatVariable: '' });
  });
});
// LOGZ.IO CHANGE END:: unsaved-changes comparison [APPZ-302]
