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

// LOGZ.IO CHANGE FILE:: Panel-level time range override provider [APPZ-2474]

import { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { AbsoluteTimeRange, DurationString, TimeRangeValue } from '@perses-dev/spec';
import { TimeRange, TimeRangeContext, useTimeRange } from '@perses-dev/plugin-system';
import { PanelTimeRangeOverrideProvider } from './PanelTimeRangeOverrideProvider';
import { PanelTimeOverrideSpec } from './resolve';

const noop = (): void => undefined;

const PARENT_RELATIVE: TimeRangeValue = { pastDuration: '6h' as DurationString };
const PARENT_RANGE_KEY = 'rel:6h:now';

const FIRST_TICK: AbsoluteTimeRange = {
  start: new Date('2026-07-16T08:00:00Z'),
  end: new Date('2026-07-16T14:00:00Z'),
};
// The same relative parent range, re-resolved 30s later — what a refresh tick looks like.
const SECOND_TICK: AbsoluteTimeRange = {
  start: new Date('2026-07-16T08:00:30Z'),
  end: new Date('2026-07-16T14:00:30Z'),
};

interface ParentProps {
  absoluteTimeRange: AbsoluteTimeRange;
  timeRange?: TimeRangeValue;
  rangeKey?: string;
}

const buildParent = ({ absoluteTimeRange, timeRange, rangeKey }: ParentProps): TimeRange => ({
  timeRange: timeRange ?? PARENT_RELATIVE,
  absoluteTimeRange,
  rangeKey: rangeKey ?? PARENT_RANGE_KEY,
  setTimeRange: noop,
  refresh: noop,
  refreshIntervalInMs: 0,
  setRefreshInterval: noop,
});

interface Captured {
  value?: TimeRange;
}

/** Renders the override provider and exposes the TimeRange its children see. */
function renderOverride(
  spec: PanelTimeOverrideSpec,
  parent: ParentProps
): { captured: Captured; rerender: (nextSpec: PanelTimeOverrideSpec, nextParent: ParentProps) => void } {
  const captured: Captured = {};

  const Capture = (): null => {
    captured.value = useTimeRange();
    return null;
  };

  const ui = (nextSpec: PanelTimeOverrideSpec, nextParent: ParentProps): ReactElement => (
    <TimeRangeContext.Provider value={buildParent(nextParent)}>
      <PanelTimeRangeOverrideProvider spec={nextSpec}>
        <Capture />
      </PanelTimeRangeOverrideProvider>
    </TimeRangeContext.Provider>
  );

  const { rerender } = render(ui(spec, parent));

  return { captured, rerender: (nextSpec, nextParent): void => rerender(ui(nextSpec, nextParent)) };
}

describe('PanelTimeRangeOverrideProvider', () => {
  test("passes the parent's rangeKey through when there is no override", () => {
    const { captured } = renderOverride({}, { absoluteTimeRange: FIRST_TICK });

    expect(captured.value?.rangeKey).toBe(PARENT_RANGE_KEY);
  });

  // A `timeShift` override re-anchors to the parent's absolute range, so the resolved window churns
  // on every refresh tick. The key must not, or overridden panels would lose the retained-data
  // optimization on every tick (see `useRetainPreviousData`).
  test('keeps the rangeKey stable across a refresh tick that only moves the absolute range', () => {
    const spec: PanelTimeOverrideSpec = { timeShift: '1d' };
    const { captured, rerender } = renderOverride(spec, { absoluteTimeRange: FIRST_TICK });

    const keyBefore = captured.value?.rangeKey;
    const windowBefore = captured.value?.absoluteTimeRange.end.valueOf();

    rerender(spec, { absoluteTimeRange: SECOND_TICK });

    expect(captured.value?.rangeKey).toBe(keyBefore);
    // ...while the resolved window really did move, so the key is not just tracking identity.
    expect(captured.value?.absoluteTimeRange.end.valueOf()).not.toBe(windowBefore);
  });

  test('distinguishes different overrides of the same parent range', () => {
    const keys = [{}, { timeShift: '1d' }, { timeShift: '2d' }, { timeFrom: '15m' }].map(
      (spec) => renderOverride(spec, { absoluteTimeRange: FIRST_TICK }).captured.value?.rangeKey
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  test('changes the rangeKey when the parent range changes', () => {
    const spec: PanelTimeOverrideSpec = { timeShift: '1d' };
    const { captured, rerender } = renderOverride(spec, { absoluteTimeRange: FIRST_TICK });

    const keyBefore = captured.value?.rangeKey;

    rerender(spec, {
      absoluteTimeRange: FIRST_TICK,
      timeRange: { pastDuration: '48h' as DurationString },
      rangeKey: 'rel:48h:now',
    });

    expect(captured.value?.rangeKey).not.toBe(keyBefore);
  });
});
