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
