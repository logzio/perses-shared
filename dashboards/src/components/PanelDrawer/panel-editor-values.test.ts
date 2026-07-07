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
import { restoreValuesStrippedByValidation } from './panel-editor-values';

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
