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

import { act, render } from '@testing-library/react';
import { EChart } from './EChart';

interface DOMRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FakeChart {
  setOption: jest.Mock;
  dispose: jest.Mock;
  dispatchAction: jest.Mock;
  isDisposed: jest.Mock;
  resize: jest.Mock;
  on: jest.Mock;
  off: jest.Mock;
  convertToPixel: jest.Mock;
  _model: { getComponent: () => { coordinateSystem: { getRect: () => DOMRectLike } } };
  hover: (timeMs: number) => void;
}

const mockCharts: FakeChart[] = [];

function mockCreateChart(): FakeChart {
  const handlers = new Map<string, Array<(event: unknown) => void>>();
  let disposed = false;

  return {
    setOption: jest.fn(),
    dispose: jest.fn(() => {
      disposed = true;
    }),
    dispatchAction: jest.fn(),
    isDisposed: jest.fn(() => disposed),
    resize: jest.fn(),
    on: jest.fn((eventName: string, handler: (event: unknown) => void) => {
      handlers.set(eventName, [...(handlers.get(eventName) ?? []), handler]);
    }),
    off: jest.fn((eventName: string, handler?: (event: unknown) => void) => {
      const remaining = (handlers.get(eventName) ?? []).filter((entry) => entry !== handler);
      handlers.set(eventName, handler === undefined ? [] : remaining);
    }),
    convertToPixel: jest.fn((_finder: unknown, value: number) => value),
    _model: {
      getComponent: () => ({ coordinateSystem: { getRect: () => ({ x: 0, y: 0, width: 100, height: 100 }) } }),
    },
    hover: (timeMs: number): void => {
      (handlers.get('updateAxisPointer') ?? []).forEach((handler) => handler({ axesInfo: [{ value: timeMs }] }));
    },
  };
}

jest.mock('echarts/core', () => ({
  init: jest.fn(() => {
    const chart = mockCreateChart();

    mockCharts.push(chart);

    return chart;
  }),
  use: jest.fn(),
}));

// jsdom has no ResizeObserver (EChart observes its container for panel resizes)
class ResizeObserverStub {
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}

(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;

// jsdom has no IntersectionObserver (EChart observes its container to stay in the sync group only
// while on screen). Observing reports the chart as visible, matching a rendered panel; tests drive
// visibility changes through setIntersecting.
const intersectionCallbacks = new Set<IntersectionObserverCallback>();

function emit(callback: IntersectionObserverCallback, isIntersecting: boolean): void {
  callback([{ isIntersecting } as IntersectionObserverEntry], null as unknown as IntersectionObserver);
}

class IntersectionObserverStub {
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    intersectionCallbacks.add(callback);
  }

  observe(): void {
    emit(this.callback, true);
  }

  unobserve(): void {}

  disconnect(): void {
    intersectionCallbacks.delete(this.callback);
  }
}

(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = IntersectionObserverStub;

function setIntersecting(isIntersecting: boolean): void {
  act(() => {
    intersectionCallbacks.forEach((callback) => emit(callback, isIntersecting));
  });
}

/** The chart instance created by the nth EChart rendered so far in this test file. */
function chartAt(index: number): FakeChart {
  const chart = mockCharts[index];

  if (chart === undefined) throw new Error(`no chart was created at index ${index}`);

  return chart;
}

describe('EChart', () => {
  it('should hide the tooltip and leave the sync group before disposing on unmount', () => {
    const index = mockCharts.length;
    const { unmount } = render(<EChart option={{}} syncGroup="sync-group-1" />);
    const chart = chartAt(index);

    unmount();

    expect(chart.dispatchAction).toHaveBeenCalledWith({ type: 'hideTip' });
    expect(chart.dispose).toHaveBeenCalledTimes(1);

    // teardown order: tooltip timers are dropped BEFORE the instance is disposed
    const hideTipOrder = chart.dispatchAction.mock.invocationCallOrder[0] ?? Infinity;
    const disposeOrder = chart.dispose.mock.invocationCallOrder[0] ?? 0;

    expect(hideTipOrder).toBeLessThan(disposeOrder);
  });

  it('should dispose exactly once per mount/unmount cycle', () => {
    const index = mockCharts.length;

    const first = render(<EChart option={{}} />);

    first.unmount();

    const second = render(<EChart option={{}} />);

    second.unmount();

    expect(chartAt(index).dispose).toHaveBeenCalledTimes(1);
    expect(chartAt(index + 1).dispose).toHaveBeenCalledTimes(1);
  });

  it('should clear escaped instance refs on unmount so holders cannot retain the disposed chart', () => {
    const index = mockCharts.length;
    const instanceRef: { current: unknown } = { current: undefined };

    const { unmount } = render(<EChart option={{}} _instance={instanceRef as never} />);

    expect(instanceRef.current).toBe(chartAt(index));

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

  // LOGZ.IO ADDITION:: sync-group membership is limited to charts that are on screen, so hovering one
  // panel no longer broadcasts crosshair actions to charts the user cannot see.
  describe('sync group membership', () => {
    it('should place the crosshair on the other charts in the group at the hovered timestamp', () => {
      const index = mockCharts.length;

      render(<EChart option={{}} syncGroup="sync-group-hover" />);
      render(<EChart option={{}} syncGroup="sync-group-hover" />);

      chartAt(index).hover(1000);

      expect(chartAt(index + 1).dispatchAction).toHaveBeenCalledWith({ type: 'updateAxisPointer', x: 1000, y: 50 });
    });

    it('should stop receiving the crosshair and drop its own when scrolled out of view', () => {
      const index = mockCharts.length;

      render(<EChart option={{}} syncGroup="sync-group-offscreen" />);
      render(<EChart option={{}} syncGroup="sync-group-offscreen" />);

      setIntersecting(false);
      chartAt(index).hover(1000);

      expect(chartAt(index + 1).dispatchAction).toHaveBeenCalledWith({ type: 'hideTip' });
      expect(chartAt(index + 1).dispatchAction).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'updateAxisPointer', x: 1000 })
      );
    });

    it('should receive the crosshair again when scrolled back into view', () => {
      const index = mockCharts.length;

      render(<EChart option={{}} syncGroup="sync-group-rejoin" />);
      render(<EChart option={{}} syncGroup="sync-group-rejoin" />);

      setIntersecting(false);
      setIntersecting(true);
      chartAt(index).hover(1000);

      expect(chartAt(index + 1).dispatchAction).toHaveBeenCalledWith({ type: 'updateAxisPointer', x: 1000, y: 50 });
    });

    it('should not broadcast the crosshair when no syncGroup is configured', () => {
      const index = mockCharts.length;

      render(<EChart option={{}} />);
      render(<EChart option={{}} />);

      chartAt(index).hover(1000);

      expect(chartAt(index + 1).dispatchAction).not.toHaveBeenCalled();
    });
  });
});
