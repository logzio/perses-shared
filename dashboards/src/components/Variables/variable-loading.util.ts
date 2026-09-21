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

// LOGZ.IO ADDITION:: whole file [unidash-perf]

import { UseQueryResult } from '@tanstack/react-query';
import { VariableOption } from '@perses-dev/plugin-system';

// The caller holds a partial query result (the variable editor renders before a query exists).
type VariableOptionsQueryState = Partial<
  Pick<UseQueryResult<VariableOption[]>, 'isFetching' | 'isPlaceholderData' | 'data'>
>;

/**
 * Whether a list variable has no options yet for the query it is currently running.
 *
 * A variable's `loading` flag gates everything that depends on it: dependent variables and every
 * panel query that interpolates it stay disabled while it is set, and it re-renders every panel,
 * because the whole dashboard subscribes to the variable state. So it has to mean "the value may
 * still change", not "a request is in flight" — a background refresh of the same query key returns
 * the same options and leaves the value alone, while a refresh triggered by a new key (a changed
 * parent variable or time range) may not, and there `data` is either absent or the previous key's
 * placeholder.
 */
export function isVariableOptionsLoading(query: VariableOptionsQueryState): boolean {
  if (!query.isFetching) {
    return false;
  }
  return query.data === undefined || query.isPlaceholderData === true;
}
