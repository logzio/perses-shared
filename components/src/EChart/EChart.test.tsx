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

// LOGZ.IO ADDITION:: guards the chart teardown path — pending tooltip timers and sync-group linkage
// must be released before dispose, otherwise unmounted charts survive GC (memory leak). [unidash-perf]

import { render } from '@testing-library/react';
import { EChart } from './EChart';

const fakeChart = {
  group: '',
  setOption: jest.fn(),
  dispose: jest.fn(),
  dispatchAction: jest.fn(),
  isDisposed: jest.fn(() => false),
  resize: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

jest.mock('echarts/core', () => ({
  init: jest.fn(() => fakeChart),
  connect: jest.fn(),
  use: jest.fn(),
}));

// jsdom has no ResizeObserver (EChart observes its container for panel resizes)
class ResizeObserverStub {
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}

(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;

describe('EChart', () => {
  it('should hide the tooltip and leave the sync group before disposing on unmount', () => {
    fakeChart.group = '';
    fakeChart.dispose.mockClear();
    fakeChart.dispatchAction.mockClear();

    const { unmount } = render(<EChart option={{}} syncGroup="sync-group-1" />);

    expect(fakeChart.group).toBe('sync-group-1');

    unmount();

    expect(fakeChart.dispatchAction).toHaveBeenCalledWith({ type: 'hideTip' });
    expect(fakeChart.group).toBe('');
    expect(fakeChart.dispose).toHaveBeenCalledTimes(1);

    // teardown order: tooltip timers are dropped BEFORE the instance is disposed
    const hideTipOrder = fakeChart.dispatchAction.mock.invocationCallOrder[0] ?? Infinity;
    const disposeOrder = fakeChart.dispose.mock.invocationCallOrder[0] ?? 0;

    expect(hideTipOrder).toBeLessThan(disposeOrder);
  });

  it('should dispose exactly once per mount/unmount cycle', () => {
    fakeChart.dispose.mockClear();

    const first = render(<EChart option={{}} />);

    first.unmount();

    const second = render(<EChart option={{}} />);

    second.unmount();

    expect(fakeChart.dispose).toHaveBeenCalledTimes(2);
  });

  it('should clear escaped instance refs on unmount so holders cannot retain the disposed chart', () => {
    const instanceRef: { current: unknown } = { current: undefined };

    const { unmount } = render(<EChart option={{}} _instance={instanceRef as never} />);

    expect(instanceRef.current).toBe(fakeChart);

    unmount();

    expect(instanceRef.current).toBeUndefined();
  });

  // LOGZ.IO ADDITION:: scrolling must not run the chart hover pipeline [unidash-perf]
  it('should suspend pointer events on the chart container while the page scrolls', () => {
    jest.useFakeTimers();

    const { container, unmount } = render(<EChart option={{}} />);
    const chartHost = container.firstChild as HTMLElement;

    window.dispatchEvent(new Event('scroll'));

    expect(chartHost.style.pointerEvents).toBe('none');

    jest.advanceTimersByTime(300);

    expect(chartHost.style.pointerEvents).toBe('');

    unmount();
    jest.useRealTimers();
  });

  it('should restore pointer events and detach the scroll listener when the last chart unmounts', () => {
    jest.useFakeTimers();

    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const { container, unmount } = render(<EChart option={{}} />);
    const chartHost = container.firstChild as HTMLElement;

    window.dispatchEvent(new Event('scroll'));

    expect(chartHost.style.pointerEvents).toBe('none');

    unmount(); // mid-suspension unmount must not leave the inline style behind

    expect(chartHost.style.pointerEvents).toBe('');
    expect(removeSpy.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(1);

    removeSpy.mockRestore();
    jest.useRealTimers();
  });
});
