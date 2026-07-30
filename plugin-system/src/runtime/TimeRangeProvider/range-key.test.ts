,m// Copyright The Perses Authors
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

import { DurationString, toAbsoluteTimeRange } from '@perses-dev/spec';
import { getTimeRangeKey } from './range-key';

describe('getTimeRangeKey', () => {
  // The whole point of the key: a relative range re-resolves to a different absolute window on
  // every refresh tick, but it is still the same window the user selected.
  test('is stable across repeated resolutions of the same relative range', () => {
    const relative = { pastDuration: '30m' as DurationString };

    const first = toAbsoluteTimeRange(relative);
    const second = toAbsoluteTimeRange(relative);

    // The resolved windows differ (or at least are free to differ) — the key does not.
    expect(getTimeRangeKey(relative)).toBe(getTimeRangeKey(relative));
    expect(getTimeRangeKey({ start: first.start, end: first.end })).not.toBe(
      getTimeRangeKey({ start: second.start, end: new Date(second.end.valueOf() + 1000) })
    );
  });

  test('distinguishes relative ranges of different durations', () => {
    expect(getTimeRangeKey({ pastDuration: '30m' as DurationString })).not.toBe(
      getTimeRangeKey({ pastDuration: '48h' as DurationString })
    );
  });

  test('distinguishes a relative range with a pinned end from an open-ended one', () => {
    const pastDuration = '30m' as DurationString;

    expect(getTimeRangeKey({ pastDuration })).not.toBe(
      getTimeRangeKey({ pastDuration, end: new Date('2026-07-16T14:00:00Z') })
    );
  });

  test('distinguishes absolute ranges by both bounds', () => {
    const start = new Date('2026-07-01T00:00:00Z');
    const end = new Date('2026-07-31T23:59:59Z');

    expect(getTimeRangeKey({ start, end })).toBe(getTimeRangeKey({ start: new Date(start), end: new Date(end) }));
    expect(getTimeRangeKey({ start, end })).not.toBe(getTimeRangeKey({ start, end: new Date('2026-07-30T23:59:59Z') }));
    expect(getTimeRangeKey({ start, end })).not.toBe(getTimeRangeKey({ start: new Date('2026-07-02T00:00:00Z'), end }));
  });

  test('never collides between a relative and an absolute range', () => {
    expect(getTimeRangeKey({ pastDuration: '30m' as DurationString })).not.toBe(
      getTimeRangeKey({ start: new Date(0), end: new Date(1) })
    );
  });
});
