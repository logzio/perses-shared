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

import { TimeSeriesData, TimeSeriesQueryDefinition, UnknownSpec } from '@perses-dev/spec';
import {
  keepPreviousData,
  Query,
  QueryCache,
  QueryKey,
  QueryObserverOptions,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import { TimeSeriesDataQuery, TimeSeriesQueryContext, TimeSeriesQueryMode } from '../model';
import { useStableQueries, useRetainPreviousData } from '../hooks';
import { useTimeRange } from './TimeRangeProvider';
import { useDatasourceStore } from './datasources';
import { usePlugin, usePluginRegistry, usePlugins } from './plugin-registry';
import { useAllVariableValues } from './variables';
// LOGZ.IO CHANGE START:: APPZ-955-math-on-queries-formulas
import {
  TIME_SERIES_QUERY_KEY,
  getQueryOptions,
  extractQueryDependencies,
  buildResolvedResults,
  createQueryConfig,
  areMapsEqual,
} from './time-series-queries-utils';
// LOGZ.IO CHANGE END:: APPZ-955-math-on-queries-formulas

export { TIME_SERIES_QUERY_KEY } from './time-series-queries-utils';

export interface UseTimeSeriesQueryOptions {
  suggestedStepMs?: number;
  mode?: TimeSeriesQueryMode;
}

/**
 * Runs a time series query using a plugin and returns the results.
 */
export const useTimeSeriesQuery = (
  definition: TimeSeriesQueryDefinition,
  options?: UseTimeSeriesQueryOptions,
  queryOptions?: QueryObserverOptions<TimeSeriesData>
): UseQueryResult<TimeSeriesData> => {
  const { data: plugin } = usePlugin(TIME_SERIES_QUERY_KEY, definition.spec.plugin.kind);
  const context = useTimeSeriesQueryContext();
  const { queryEnabled, queryKey } = getQueryOptions(plugin, definition, context);

  return useQuery({
    enabled: (queryOptions?.enabled ?? true) || queryEnabled,
    // LOGZ.IO CHANGE:: keep previous data on refresh/time-range change to avoid skeleton flicker
    placeholderData: keepPreviousData,
    queryKey: queryKey,
    queryFn: ({ signal }) => {
      // The 'enabled' option should prevent this from happening, but make TypeScript happy by checking
      if (plugin === undefined) {
        throw new Error('Expected plugin to be loaded');
      }
      // Keep options out of query key so we don't re-run queries because suggested step changes
      const ctx: TimeSeriesQueryContext = { ...context, suggestedStepMs: options?.suggestedStepMs };
      return plugin.getTimeSeriesData(definition.spec.plugin.spec, ctx, signal);
    },
  });
};

/**
 * Runs multiple time series queries using plugins and returns the results.
 * Supports queries that depend on other query results via dependsOn.queries.
 * Handles chained dependencies of any depth via dynamic dependency resolution.
 */
export function useTimeSeriesQueries(
  definitions: TimeSeriesQueryDefinition[],
  options?: UseTimeSeriesQueryOptions,
  queryOptions?: Omit<QueryObserverOptions, 'queryKey'>
): Array<UseQueryResult<TimeSeriesData>> {
  // Track resolved results in state to trigger re-renders for dependent queries
  const [resolvedResults, setResolvedResults] = useState<Map<number, TimeSeriesData>>(new Map());

  const { getPlugin } = usePluginRegistry();
  const baseContext = useTimeSeriesQueryContext();
  // LOGZ.IO CHANGE:: scopes retained data to the selected window [stale-timeframe]
  const { rangeKey } = useTimeRange();

  const context = useMemo(
    () => ({
      ...baseContext,
      mode: options?.mode,
      suggestedStepMs: options?.suggestedStepMs,
    }),
    [baseContext, options?.mode, options?.suggestedStepMs]
  );

  const pluginLoaderResponse = usePlugins(
    TIME_SERIES_QUERY_KEY,
    definitions.map((d) => ({ kind: d.spec.plugin.kind }))
  );

  // LOGZ.IO CHANGE START:: APPZ-955-math-on-queries-formulas
  const dependencies = useMemo(
    () => extractQueryDependencies(definitions, pluginLoaderResponse, context),
    [definitions, pluginLoaderResponse, context]
  );

  const queries = useMemo(() => {
    return definitions.map((definition, idx) =>
      createQueryConfig({
        definition,
        plugin: pluginLoaderResponse[idx]?.data,
        context,
        queryIndex: idx,
        getPlugin,
        queryOptions,
        resolvedResults,
        dependencies,
      })
    );
  }, [definitions, pluginLoaderResponse, context, dependencies, getPlugin, queryOptions, resolvedResults]);

  // LOGZ.IO CHANGE:: Performance optimization [APPZ-359] useStableQueries()
  const results = useStableQueries({ queries }) as Array<UseQueryResult<TimeSeriesData>>;

  // LOGZ.IO CHANGE:: keep the previous data while a *refresh* refetches, so panels show only the
  // header spinner instead of swapping to the full skeleton. keepPreviousData cannot do this for
  // useQueries (its observer is recreated on key change), so retain the data manually. Scoped by
  // `rangeKey` so it is never retained across a time-range change. [stale-timeframe]
  const retainedResults = useRetainPreviousData(results, rangeKey);

  // Memoize resolved results computation to avoid rebuilding in every effect run.
  // LOGZ.IO CHANGE:: built from `results`, NOT `retainedResults` — this map both gates (`depsResolved`)
  // and keys (`depsFingerprint`) dependent `__expr__`/math queries, so feeding it retained data makes
  // them fire against the previous window's inputs and emit a result stamped with that window.
  // Sourcing it from the raw results makes a dependent query wait for real data; retention still
  // covers the visuals while it waits. [stale-timeframe]
  const newResolved = useMemo(() => buildResolvedResults(results), [results]);

  // Sync resolved results when data references change
  useEffect(() => {
    if (!areMapsEqual(newResolved, resolvedResults)) {
      setResolvedResults(newResolved);
    }
  }, [newResolved, resolvedResults]);

  return retainedResults;
  // LOGZ.IO CHANGE END:: APPZ-955-math-on-queries-formulas
}

/**
 * Build the time series query context object from data available at runtime
 */
function useTimeSeriesQueryContext(): TimeSeriesQueryContext {
  const { absoluteTimeRange } = useTimeRange();
  const variableState = useAllVariableValues();
  const datasourceStore = useDatasourceStore();

  return {
    timeRange: absoluteTimeRange,
    variableState,
    datasourceStore,
  };
}

/**
 * Get active time series queries for query results summary
 */
export function useActiveTimeSeriesQueries(): TimeSeriesDataQuery[] {
  const queryClient = useQueryClient();
  const queryCache = queryClient.getQueryCache();
  return getActiveTimeSeriesQueries(queryCache);
}

/**
 * Filter all cached queries down to only active time series queries
 */
export function getActiveTimeSeriesQueries(cache: QueryCache): TimeSeriesDataQuery[] {
  const queries: TimeSeriesDataQuery[] = [];

  for (const query of cache.findAll({ type: 'active' })) {
    const firstPart = query.queryKey?.[0] as UnknownSpec;
    if (firstPart?.kind && (firstPart.kind as string).startsWith(TIME_SERIES_QUERY_KEY)) {
      queries.push(query as Query<TimeSeriesData, unknown, TimeSeriesData, QueryKey>);
    }
  }

  return queries;
}
