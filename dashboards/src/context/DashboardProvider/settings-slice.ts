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

// LOGZ.IO CHANGE START

import { DashboardSettings } from '@perses-dev/client';
import { StateCreator } from 'zustand';
import { Middleware } from './common';

/**
 * Slice that carries dashboard-wide settings through the store so they survive a save.
 */
export interface SettingsSlice {
  settings?: DashboardSettings;
  /**
   * Replaces the whole settings object. `undefined` removes it from the saved spec.
   */
  setSettings: (settings?: DashboardSettings) => void;
}

/**
 * Creates a slice for managing dashboard settings state.
 * @param initSettings - Initial settings object from the dashboard spec.
 */
export function createSettingsSlice(
  initSettings?: DashboardSettings
): StateCreator<SettingsSlice, Middleware, [], SettingsSlice> {
  return (set) => ({
    settings: initSettings,
    setSettings: (settings?: DashboardSettings): void => {
      set((state) => {
        state.settings = settings;
      });
    },
  });
}

// LOGZ.IO CHANGE END
