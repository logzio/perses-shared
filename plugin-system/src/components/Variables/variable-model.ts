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

import { ListVariableDefinition, VariableDefinition, VariableValue } from '@perses-dev/spec';
import { useQueries, useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { GetVariableOptionsContext, VariableOption, VariablePlugin } from '../../model';
import {
  useAllVariableValues,
  useDatasourceStore,
  usePlugin,
  usePlugins,
  useTimeRange,
  VariableStateMap,
} from '../../runtime';

// LOGZ.IO CHANGE START:: Apply capturing regex to label as fallback for datasource variables
function extractCapturedValue(text: string, regexp: RegExp): string {
  const matches = text.matchAll(regexp);
  let concat = '';
  for (const match of matches) {
    for (let i = 1; i < match.length; i++) {
      const m = match[i];
      if (m !== undefined) {
        concat = `${concat}${m}`;
      }
    }
  }
  return concat;
}
// LOGZ.IO CHANGE END:: Apply capturing regex to label as fallback for datasource variables

export function filterVariableList(
  data: VariableOption[],
  capturedRegexp: RegExp,
  // LOGZ.IO CHANGE:: when true, the regex only filters the list and each original value is kept.
  // Datasource variables must keep the real datasource name as their value, otherwise panels can no
  // longer reference them (the captured fragment is not a known datasource name and is silently dropped).
  preserveOriginalValue = false
): VariableOption[] {
  const result: VariableOption[] = [];
  const filteredSet = new Set<string>();
  for (const variableValue of data) {
    // LOGZ.IO CHANGE START:: Apply capturing regex to label as fallback for datasource variables
    let concat = extractCapturedValue(variableValue.value, capturedRegexp);
    if (concat === '' && variableValue.label) {
      concat = extractCapturedValue(variableValue.label, capturedRegexp);
    }
    // LOGZ.IO CHANGE END:: Apply capturing regex to label as fallback for datasource variables
    if (concat !== '') {
      // LOGZ.IO CHANGE START:: keep the original value for datasource variables (regex is filter-only)
      const value = preserveOriginalValue ? variableValue.value : concat;
      // LOGZ.IO CHANGE START:: show the captured fragment in the dropdown. Grafana sets both the
      // displayed text and the value to the captured group, so a regex like `-([0-9]+$)` turns
      // `cluster-103` into `103` in the dropdown — not just in the submitted value. Datasource
      // variables keep their original label because their value is preserved (the captured fragment
      // is not a real datasource name).
      const label = preserveOriginalValue ? variableValue.label : concat;
      // LOGZ.IO CHANGE END:: show the captured fragment in the dropdown
      if (!filteredSet.has(value)) {
        // like that we are avoiding to have duplicating variable value
        filteredSet.add(value);
        result.push({ label, value });
      }
      // LOGZ.IO CHANGE END:: keep the original value for datasource variables (regex is filter-only)
    }
  }
  return result;
}

function useVariablePluginContext(): GetVariableOptionsContext {
  const datasourceStore = useDatasourceStore();
  const allVariables = useAllVariableValues();
  const { absoluteTimeRange: timeRange } = useTimeRange();

  return { timeRange, datasourceStore, variables: allVariables };
}

// LOGZ.IO CHANGE START:: an invalid capturingRegexp must never crash the variable editor or dashboard.
// `new RegExp` throws on a malformed pattern (e.g. `-([0-1]{0,3}$` — unterminated group). Because the
// regex was built during render, a single bad or half-typed pattern crashed the whole variable editor
// and left it stuck returning no values until a full save + reload — even after the regex was removed.
// Grafana simply ignores an unparseable regex; we do the same and fall back to "no filter" (and an empty
// field is "no filter" too) so the raw values keep flowing and the user can fix or clear the field.
export function safeParseCapturingRegexp(pattern: string | undefined): RegExp | undefined {
  if (!pattern) return undefined;
  try {
    return new RegExp(pattern, 'g');
  } catch {
    return undefined;
  }
}
// LOGZ.IO CHANGE END:: an invalid capturingRegexp must never crash the variable editor or dashboard

const getVariableQueryConfig = (
  definition: ListVariableDefinition,
  variablePluginCtx: GetVariableOptionsContext,
  variablePlugin: VariablePlugin | undefined,
  enabled: boolean,
  onFetched?: (name: string, options: VariableOption[], definition: ListVariableDefinition) => void
): UseQueryOptions<VariableOption[]> => {
  // LOGZ.IO CHANGE:: empty OR invalid capturing regex is treated as "no filter" (see safeParseCapturingRegexp)
  const capturingRegexp = safeParseCapturingRegexp(definition.spec.capturingRegexp);
  const variablesValueKey = getVariableValuesKey(variablePluginCtx.variables);
  return {
    queryKey: ['variable', definition, variablePluginCtx.timeRange, variablesValueKey],
    queryFn: async ({ signal }): Promise<VariableOption[]> => {
      const resp = await variablePlugin?.getVariableOptions(definition.spec.plugin.spec, variablePluginCtx, signal);
      if (!resp?.data?.length) {
        onFetched?.(definition.spec.name, [], definition);
        return [];
      }
      // LOGZ.IO CHANGE START:: datasource variables filter by regex but keep the real datasource name as value
      const isDatasourceVariable = definition.spec.plugin.kind.endsWith('DatasourceVariable');
      const options = capturingRegexp
        ? filterVariableList(resp.data, capturingRegexp, isDatasourceVariable)
        : resp.data;
      // LOGZ.IO CHANGE END:: datasource variables filter by regex but keep the real datasource name as value
      onFetched?.(definition.spec.name, options, definition);
      return options;
    },
    enabled,
  };
};

function resolveDependsOnVariables(
  variablePlugin: VariablePlugin | undefined,
  variablePluginCtx: GetVariableOptionsContext,
  definition: ListVariableDefinition
): string[] {
  if (variablePlugin?.dependsOn) {
    const dependencies = variablePlugin.dependsOn(definition.spec.plugin.spec, variablePluginCtx);
    return dependencies.variables ? dependencies.variables.filter((v) => v !== definition.spec.name) : []; // Exclude self variable to avoid circular dependency and default to empty array to avoid deadlock
  }
  return [];
}

export function useListVariablePluginValues(definition: ListVariableDefinition): UseQueryResult<VariableOption[]> {
  const { data: variablePlugin } = usePlugin('Variable', definition.spec.plugin.kind);

  const variablePluginCtx = useVariablePluginContext();

  const dependsOnVariables = resolveDependsOnVariables(variablePlugin, variablePluginCtx, definition);

  const dependentVariables = useAllVariableValues(dependsOnVariables);
  const waitToLoad = dependsOnVariables.some((v) => dependentVariables[v]?.loading);

  const ctx = { ...variablePluginCtx, variables: dependentVariables };

  return useQuery(getVariableQueryConfig(definition, ctx, variablePlugin, !!variablePlugin && !waitToLoad));
}

function resolveDefaultValue(definition: ListVariableDefinition, options: VariableOption[]): VariableValue {
  const { defaultValue, allowMultiple } = definition.spec;
  if (defaultValue !== undefined && defaultValue !== null) {
    return defaultValue;
  }
  if (options[0]?.value) {
    const first = options[0].value;
    return allowMultiple ? [first] : first;
  }
  return allowMultiple ? [] : '';
}

/**
 * Resolves initial values for all ListVariable definitions by fetching their options in dependency order.
 * Returns a map of variable names to their resolved default values, merging with any already-provided outer variables.
 */
export function useResolveListVariableValues(variableDefinitions: VariableDefinition[]): {
  initialVariableValues: Record<string, VariableValue>;
  isLoading: boolean;
} {
  const { timeRange, datasourceStore, variables: outerVariableValues } = useVariablePluginContext();

  const listVariables = useMemo(
    () => variableDefinitions.filter((v): v is ListVariableDefinition => v.kind === 'ListVariable'),
    [variableDefinitions]
  );

  const pluginResults = usePlugins(
    'Variable',
    listVariables.map((d) => ({ kind: d.spec.plugin.kind }))
  );

  // Resolved variable state. Updated by onFetched when queries resolve.
  // Needed because of dependencies between variables that require multiple rounds of fetching.
  const [resolvedVariables, setResolvedVariables] = useState<VariableStateMap>({});

  const allVariables = useMemo(() => {
    return { ...outerVariableValues, ...resolvedVariables };
  }, [outerVariableValues, resolvedVariables]);

  const onFetched = useCallback((name: string, options: VariableOption[], definition: ListVariableDefinition) => {
    setResolvedVariables((prev) => {
      const value = resolveDefaultValue(definition, options);
      const existing = prev[name];
      // LOGZ.IO CHANGE START
      if (existing && JSON.stringify(existing.value) === JSON.stringify(value)) {
        return prev;
      }
      // LOGZ.IO CHANGE END
      return {
        ...prev,
        [name]: { value, loading: false, options },
      };
    });
  }, []);

  const queryResults = useQueries({
    queries: listVariables.map((definition, index) => {
      const plugin = pluginResults[index]?.data;
      const isPluginLoading = pluginResults[index]?.isLoading ?? true;

      const dependsOn = resolveDependsOnVariables(
        plugin,
        { timeRange, datasourceStore, variables: allVariables },
        definition
      );

      const hasPendingDeps = dependsOn.some(
        (v) =>
          (resolvedVariables[v] === undefined && listVariables.some((lv) => lv.spec.name === v)) ||
          allVariables[v]?.loading
      );

      const dependentVariables: VariableStateMap = {};
      for (const v of dependsOn) {
        const state = allVariables[v];
        if (state) {
          dependentVariables[v] = state;
        }
      }

      const ctx = { timeRange, datasourceStore, variables: dependentVariables };
      return getVariableQueryConfig(definition, ctx, plugin, !hasPendingDeps && !isPluginLoading, onFetched);
    }),
  });

  const initialVariableValues: Record<string, VariableValue> = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(allVariables)
          .filter(([, state]) => state?.value !== undefined)
          .map(([name, state]) => [name, state!.value])
      ),
    [allVariables]
  );

  // LOGZ.IO CHANGE:: fork runs @tanstack/react-query v5, where a dependency-disabled query is `isPending`
  // (v4 reported it as `isLoading`); use isPending so "waiting on deps" still counts as loading [APPZ-2153]
  return { initialVariableValues, isLoading: queryResults.some((r) => r.isPending) };
}

/**
 * Returns a serialized string of the current state of variable values.
 */
export function getVariableValuesKey(v: VariableStateMap): string {
  return Object.values(v)
    .map((v) => JSON.stringify(v.value))
    .join(',');
}

export const VARIABLE_TYPES = [
  { label: 'List', kind: 'ListVariable' },
  { label: 'Text', kind: 'TextVariable' },
] as const;
