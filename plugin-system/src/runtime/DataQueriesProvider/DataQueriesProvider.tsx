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

import { createContext, ReactElement, useCallback, useContext, useMemo } from 'react';
import { QueryType, TimeSeriesQueryDefinition } from '@perses-dev/spec';
import { useTimeSeriesQueries } from '../time-series-queries';
import { useTraceQueries, TraceQueryDefinition } from '../trace-queries';
import { useProfileQueries, ProfileQueryDefinition } from '../profile-queries';
import { useAlertsQueries, AlertsQueryDefinition } from '../alerts-queries';
import { useSilencesQueries, SilencesQueryDefinition } from '../silences-queries';

import { useUsageMetrics } from '../UsageMetricsProvider';
import { LogQueryDefinition, useLogQueries } from '../log-queries';
import {
  DataQueriesProviderProps,
  UseDataQueryResults,
  transformQueryResults,
  DataQueriesContextType,
  QueryData,
} from './model';

export const DataQueriesContext = createContext<DataQueriesContextType | undefined>(undefined);

export function useDataQueriesContext(): DataQueriesContextType {
  const ctx = useContext(DataQueriesContext);
  if (ctx === undefined) {
    throw new Error('No DataQueriesContext found. Did you forget a Provider?');
  }
  return ctx;
}

export function useDataQueries<T extends keyof QueryType>(queryType: T): UseDataQueryResults<QueryType[T]> {
  const ctx = useDataQueriesContext();

  // Filter query definitions based on the specified query type
  const filteredQueryDefinitions = ctx.queryDefinitions.filter((definition) => definition.kind === queryType);

  // Filter the query results based on the specified query type
  const filteredQueryResults = ctx.queryResults.filter(
    (queryResult) => queryResult?.definition?.kind === queryType
  ) as Array<QueryData<QueryType[T]>>;

  // Filter the errors based on the specified query type
  const filteredErrors = ctx.errors.filter((errors, index) => ctx.queryResults[index]?.definition?.kind === queryType);

  // Create a new context object with the filtered results and errors
  return {
    queryDefinitions: filteredQueryDefinitions,
    queryResults: filteredQueryResults,
    isFetching: filteredQueryResults.some((result) => result.isFetching),
    isLoading: filteredQueryResults.some((result) => result.isLoading),
    refetchAll: ctx.refetchAll,
    errors: filteredErrors,
  };
}

export function DataQueriesProvider(props: DataQueriesProviderProps): ReactElement {
  const { definitions, options, children, queryOptions } = props;

  const usageMetrics = useUsageMetrics();

  // Filter definitions for time series query and other future query plugins
  // LOGZ.IO CHANGE START:: derived once per `definitions` identity [unidash-perf]
  // Six fresh arrays per render made the context value below change on every render of this provider,
  // so any re-render of the grid re-rendered every panel body through the context.
  const { timeSeriesQueries, traceQueries, profileQueries, logQueries, alertsQueries, silencesQueries } = useMemo(
    () => ({
      timeSeriesQueries: definitions.filter((d) => d.kind === 'TimeSeriesQuery') as TimeSeriesQueryDefinition[],
      traceQueries: definitions.filter((d) => d.kind === 'TraceQuery') as TraceQueryDefinition[],
      profileQueries: definitions.filter((d) => d.kind === 'ProfileQuery') as ProfileQueryDefinition[],
      logQueries: definitions.filter((d) => d.kind === 'LogQuery') as LogQueryDefinition[],
      alertsQueries: definitions.filter((d) => d.kind === 'AlertsQuery') as AlertsQueryDefinition[],
      silencesQueries: definitions.filter((d) => d.kind === 'SilencesQuery') as SilencesQueryDefinition[],
    }),
    [definitions]
  );
  // LOGZ.IO CHANGE END:: derived once per `definitions` identity [unidash-perf]
  const timeSeriesResults = useTimeSeriesQueries(timeSeriesQueries, options, queryOptions);
  const traceResults = useTraceQueries(traceQueries);
  const profileResults = useProfileQueries(profileQueries);
  const logResults = useLogQueries(logQueries);
  const alertsResults = useAlertsQueries(alertsQueries);
  const silencesResults = useSilencesQueries(silencesQueries);

  const refetchAll = useCallback(() => {
    timeSeriesResults.forEach((result) => result.refetch());
    traceResults.forEach((result) => result.refetch());
    profileResults.forEach((result) => result.refetch());
    logResults.forEach((result) => result.refetch());
    alertsResults.forEach((result) => result.refetch());
    silencesResults.forEach((result) => result.refetch());
  }, [timeSeriesResults, traceResults, profileResults, logResults, alertsResults, silencesResults]);

  const ctx = useMemo(() => {
    const mergedQueryResults = [
      ...transformQueryResults(timeSeriesResults, timeSeriesQueries),
      ...transformQueryResults(traceResults, traceQueries),
      ...transformQueryResults(profileResults, profileQueries),
      ...transformQueryResults(logResults, logQueries),
      ...transformQueryResults(alertsResults, alertsQueries),
      ...transformQueryResults(silencesResults, silencesQueries),
    ];

    if (queryOptions?.enabled) {
      for (const result of mergedQueryResults) {
        if (!result.isLoading && !result.isFetching && !result.error) {
          usageMetrics.markQuery(result.definition, 'success');
        } else if (result.error) {
          usageMetrics.markQuery(result.definition, 'error');
        } else {
          usageMetrics.markQuery(result.definition, 'pending');
        }
      }
    }

    return {
      queryDefinitions: definitions,
      queryResults: mergedQueryResults,
      isFetching: mergedQueryResults.some((result) => result.isFetching),
      isLoading: mergedQueryResults.some((result) => result.isLoading),
      refetchAll,
      errors: mergedQueryResults.map((result) => result.error),
    };
  }, [
    alertsQueries,
    alertsResults,
    logQueries,
    logResults,
    profileQueries,
    profileResults,
    silencesQueries,
    silencesResults,
    timeSeriesQueries,
    timeSeriesResults,
    traceQueries,
    traceResults,
    definitions,
    queryOptions?.enabled,
    refetchAll,
    usageMetrics,
  ]);

  return <DataQueriesContext.Provider value={ctx}>{children}</DataQueriesContext.Provider>;
}
