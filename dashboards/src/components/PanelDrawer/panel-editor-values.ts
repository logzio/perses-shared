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

import { PanelEditorValues, QueryDefinition } from '@perses-dev/spec';
import { RepeatablePanelEditorValues } from '../../model';

interface PanelSpecTimeOverrides {
  timeFrom?: string;
  timeShift?: string;
  hideTimeOverride?: boolean;
}

/**
 * The default panel editor Zod schema (`@perses-dev/spec`) declares only the upstream fields —
 * `display` / `plugin` / `queries` / `links` on the panel spec and `name` / `plugin` on each query
 * spec — and Zod objects strip unknown keys during parsing, so the Logz.io extension fields are
 * missing from the validated values `react-hook-form` hands to the submit handler:
 * - panel spec: `timeFrom` / `timeShift` / `hideTimeOverride` (panel time override, APPZ-2474)
 * - query spec: `hidden` ("Hide from chart", APPZ-955)
 * - top level: `repeat` (item-level repeat) — a layout value, not part of the panel
 *
 * We don't replace the schema (matching its typing surface globally is fragile and broke other
 * validations); instead this re-attaches those fields from the raw (pre-validation) form values
 * onto the validated result before it is saved. Validation never reorders or filters the queries
 * array, so raw and validated queries align by index.
 */
export function restoreValuesStrippedByValidation(
  validated: RepeatablePanelEditorValues,
  raw: RepeatablePanelEditorValues
): RepeatablePanelEditorValues {
  const rawSpec = raw.panelDefinition.spec as PanelEditorValues['panelDefinition']['spec'] & PanelSpecTimeOverrides;

  const queries = validated.panelDefinition.spec.queries?.map((query, index): QueryDefinition => {
    const rawHidden = (raw.panelDefinition.spec.queries?.[index]?.spec as { hidden?: boolean } | undefined)?.hidden;
    if (rawHidden === undefined) {
      return query;
    }
    // `hidden` lives on the query spec but the `@perses-dev/spec` types omit it
    return { ...query, spec: { ...query.spec, hidden: rawHidden } as QueryDefinition['spec'] };
  });

  return {
    ...validated,
    ...(raw.repeat !== undefined && { repeat: raw.repeat }),
    panelDefinition: {
      ...validated.panelDefinition,
      spec: {
        ...validated.panelDefinition.spec,
        ...(queries !== undefined && { queries }),
        ...(rawSpec.timeFrom !== undefined && rawSpec.timeFrom !== '' && { timeFrom: rawSpec.timeFrom }),
        ...(rawSpec.timeShift !== undefined && rawSpec.timeShift !== '' && { timeShift: rawSpec.timeShift }),
        ...(rawSpec.hideTimeOverride !== undefined && { hideTimeOverride: rawSpec.hideTimeOverride }),
      } as PanelEditorValues['panelDefinition']['spec'],
    },
  };
}

// LOGZ.IO CHANGE START:: unsaved-changes comparison, extracted from PanelEditorForm so the
// normalization rules are unit-testable [APPZ-302]

/** An absent `display` and one with neither a name nor a description mean the same thing. */
function normalizeDisplay(values: RepeatablePanelEditorValues): RepeatablePanelEditorValues {
  if (
    values.panelDefinition.spec.display?.name === undefined &&
    values.panelDefinition.spec.display?.description === undefined
  ) {
    values.panelDefinition.spec.display = undefined;
  }

  return values;
}

/**
 * A repeat with no variable is no repeat.
 *
 * Three shapes all mean "not repeated" and must compare equal: the key being absent entirely (how
 * `create` mode seeds `initialValues`), a `repeatVariable` of `undefined` (how `update` mode seeds it
 * for an unrepeated panel), and the empty string the editor's "None" option submits. Without this,
 * `RepeatOptionsEditor` registering `repeat.*` with react-hook-form makes `form.getValues()`
 * materialize a `repeat` object that the seeded values lack, so an untouched panel reads as dirty and
 * Cancel raises a spurious "Discard Changes" dialog.
 *
 * Direction and max-per-row only mean anything alongside a variable, so they drop with it.
 */
function normalizeRepeat(values: RepeatablePanelEditorValues): RepeatablePanelEditorValues {
  if (!values.repeat?.repeatVariable) {
    values.repeat = undefined;
  }

  return values;
}

/**
 * Whether the editor holds edits worth warning about before discarding.
 *
 * Compared as JSON so field order is the only structural assumption; `undefined` members drop out on
 * both sides, which is what lets the normalizations above collapse equivalent shapes.
 */
export function hasUnsavedChanges(
  initialValues: RepeatablePanelEditorValues,
  currentValues: RepeatablePanelEditorValues
): boolean {
  const normalize = (values: RepeatablePanelEditorValues): RepeatablePanelEditorValues =>
    normalizeRepeat(normalizeDisplay(JSON.parse(JSON.stringify(values))));

  return JSON.stringify(normalize(initialValues)) !== JSON.stringify(normalize(currentValues));
}
// LOGZ.IO CHANGE END:: unsaved-changes comparison, extracted from PanelEditorForm [APPZ-302]
