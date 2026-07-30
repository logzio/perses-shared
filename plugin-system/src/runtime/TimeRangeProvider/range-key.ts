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

// LOGZ.IO CHANGE FILE:: stable identity for the selected time range [stale-timeframe]

import { TimeRangeValue, isRelativeTimeRange } from '@perses-dev/spec';

/**
 * A stable identity for the time range the user *selected*.
 *
 * Derived from the declared `TimeRangeValue`, deliberately NOT from the resolved
 * `absoluteTimeRange`: a relative range such as "Last 30 minutes" re-resolves to a new absolute
 * window on every refresh tick, yet it is still the same window the user asked for. Consumers that
 * must tell "the clock moved" apart from "the user picked a different range" key off this rather
 * than off the absolute range — see `useRetainPreviousData`.
 */
export function getTimeRangeKey(timeRange: TimeRangeValue): string {
  if (isRelativeTimeRange(timeRange)) {
    // A relative range may pin its end. Two ranges of the same duration with different pinned
    // ends are different windows, so the end has to participate.
    return `rel:${timeRange.pastDuration}:${timeRange.end === undefined ? 'now' : timeRange.end.valueOf()}`;
  }

  return `abs:${timeRange.start.valueOf()}:${timeRange.end.valueOf()}`;
}
