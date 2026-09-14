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

import { ProjectMetadata } from '@perses-dev/client';
import { DashboardSpec } from '@perses-dev/spec';

export type DashboardKind = 'Dashboard' | 'EphemeralDashboard';

// LOGZ.IO CHANGE START
/**
 * Dashboard-wide settings that panels and queries inherit unless they set their own value.
 * Opaque here on purpose: the host application owns the concrete shape.
 */
export type DashboardSettings = Record<string, unknown>;
// LOGZ.IO CHANGE END

export interface DashboardResource {
  kind: DashboardKind;
  spec: DashboardSpec & { settings?: DashboardSettings }; // LOGZ.IO CHANGE
  metadata: ProjectMetadata;
}
