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

import { usePlugin, PanelData, PanelProps } from '@perses-dev/plugin-system';
import { UnknownSpec, QueryDataType } from '@perses-dev/spec';
import { ReactElement, useMemo } from 'react';
import { Skeleton } from '@mui/material';

interface PanelPluginProps extends PanelProps<UnknownSpec, QueryDataType> {
  kind: string;
}

// LOGZ.IO ADDITION:: shared empty list, so a plugin without query support is handed the same
// array on every render. [unidash-perf]
const NO_QUERY_RESULTS: Array<PanelData<QueryDataType>> = [];

/**
 * PanelPluginLoader loads the panel plugin specified by the 'kind' prop from the plugin registry and
 * renders its PanelComponent.
 */
export function PanelPluginLoader(props: PanelPluginProps): ReactElement {
  const { kind, spec, contentDimensions, definition, queryResults } = props;
  const { data: plugin, isLoading: isPanelLoading } = usePlugin('Panel', kind, { throwOnError: true }); // LOGZ.IO CHANGE: `useErrorBoundary` was changed to `throwOnError` for tanstack query v4 -> v5 support
  const PanelComponent = plugin?.PanelComponent;

  // LOGZ.IO CHANGE START:: the plugin's `queryResults` prop keeps its identity [unidash-perf]
  // This list was built in the render body, so every panel plugin saw a new array on every render of
  // its panel — including renders where no data had changed. That re-runs the plugin's own data
  // memo, rebuilds its chart option and costs a full `setOption`. Plugins with no supported query
  // type share one empty list for the same reason.
  const compatibleQueryResults = useMemo(() => {
    const supportedQueryTypes = plugin?.supportedQueryTypes ?? [];
    // Clear out the queryResults parameter for plugins which don't support any query types
    if (supportedQueryTypes.length === 0) {
      return NO_QUERY_RESULTS;
    }
    // APPZ-1695 filter incompatible queries instead of throwing during panel type transitions
    return queryResults.filter((queryResult) => supportedQueryTypes.includes(queryResult.definition.kind));
  }, [plugin, queryResults]);
  // LOGZ.IO CHANGE END:: the plugin's `queryResults` prop keeps its identity [unidash-perf]

  // Show fullsize skeleton if the panel plugin is loading.
  if (isPanelLoading) {
    return (
      <Skeleton
        variant="rectangular"
        width={contentDimensions?.width}
        height={contentDimensions?.height}
        aria-label="Loading..."
      />
    );
  }

  if (PanelComponent === undefined) {
    throw new Error(`Missing PanelComponent from panel plugin for kind '${kind}'`);
  }

  return (
    <PanelComponent
      spec={spec}
      contentDimensions={contentDimensions}
      definition={definition}
      queryResults={compatibleQueryResults}
    />
  );
}
