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

// LOGZ.IO ADDITION:: shared DOM crosshair [unidash-perf]

import {
  clearSharedCrosshair,
  getSharedCrosshair,
  setSharedCrosshair,
  subscribeToSharedCrosshair,
} from './crosshair-store';

describe('crosshair-store', () => {
  it('should publish a position to every subscriber', () => {
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribeFirst = subscribeToSharedCrosshair(first);
    const unsubscribeSecond = subscribeToSharedCrosshair(second);

    setSharedCrosshair({ timestampMs: 1_000, sourceId: 'panel-a' });

    expect(getSharedCrosshair()).toEqual({ timestampMs: 1_000, sourceId: 'panel-a' });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    unsubscribeSecond();
    clearSharedCrosshair('panel-a');
  });

  it('should not notify subscribers when the same position is published again', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToSharedCrosshair(listener);

    setSharedCrosshair({ timestampMs: 2_000, sourceId: 'panel-a' });
    setSharedCrosshair({ timestampMs: 2_000, sourceId: 'panel-a' });

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    clearSharedCrosshair('panel-a');
  });

  it('should keep the newest panel position when the panel just left clears late', () => {
    // Moving straight from one panel to the next: the new panel publishes before the old panel's
    // leave arrives. A late clear from the old panel must not wipe the line the new one just drew.
    setSharedCrosshair({ timestampMs: 3_000, sourceId: 'panel-a' });
    setSharedCrosshair({ timestampMs: 3_100, sourceId: 'panel-b' });

    clearSharedCrosshair('panel-a');

    expect(getSharedCrosshair()).toEqual({ timestampMs: 3_100, sourceId: 'panel-b' });

    clearSharedCrosshair('panel-b');
    expect(getSharedCrosshair()).toBeNull();
  });

  it('should stop notifying after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToSharedCrosshair(listener);

    unsubscribe();
    setSharedCrosshair({ timestampMs: 4_000, sourceId: 'panel-a' });

    expect(listener).not.toHaveBeenCalled();

    clearSharedCrosshair('panel-a');
  });
});
