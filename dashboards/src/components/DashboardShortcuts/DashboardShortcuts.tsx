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

// LOGZ.IO ADDITION:: render-isolated host for useDashboardShortcuts [unidash-perf]
// The hook subscribes to the focused-panel key, which changes on every panel enter and leave. Called
// directly from DashboardAppContent that re-rendered the whole dashboard on each crossing — and through
// DataQueriesProvider, every panel body with it (measured: 2 React tasks of ~85ms and ~1000 DOM
// mutations across all mounted panels per crossing). Rendered as a leaf, only this null component
// re-renders.

import { ReactElement } from 'react';
import { useDashboardShortcuts, UseDashboardShortcutsOptions } from './useDashboardShortcuts';

export function DashboardShortcuts(props: UseDashboardShortcutsOptions): ReactElement | null {
  useDashboardShortcuts(props);
  return null;
}
