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

// LOGZ.IO ADDITION:: regression tests for useMousePosition mousemove throttling [unidash-perf]

import { act, renderHook } from '@testing-library/react';
import { useMousePosition } from './tooltip-model';

// Replaces requestAnimationFrame with a manually-flushed queue so we can assert how many frames
// the hook schedules and control when its coalesced update runs. Returns a restore() to undo the
// patch (beforeEach/afterEach are disallowed, so each test self-contains its setup + teardown).
function mockAnimationFrame(): {
  raf: jest.Mock;
  flush: () => void;
  restore: () => void;
} {
  const callbacks: FrameRequestCallback[] = [];
  const originalRaf = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;
  const raf = jest.fn((cb: FrameRequestCallback): number => callbacks.push(cb));
  window.requestAnimationFrame = raf as unknown as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = jest.fn() as unknown as typeof window.cancelAnimationFrame;

  const flush = (): void => {
    const pending = callbacks.splice(0);
    pending.forEach((cb) => cb(0));
  };
  const restore = (): void => {
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancel;
  };
  return { raf, flush, restore };
}

function dispatchMove(target: HTMLElement, clientX: number): void {
  target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX, clientY: clientX }));
}

describe('useMousePosition', () => {
  it('should coalesce multiple mousemove events into a single animation-frame update', () => {
    const { raf, flush, restore } = mockAnimationFrame();
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    const { result } = renderHook(() => useMousePosition());

    act(() => {
      dispatchMove(canvas, 10);
      dispatchMove(canvas, 20);
      dispatchMove(canvas, 30);
    });

    // The first move onto the canvas flushes synchronously (hover-enter latency); the rest of the
    // burst coalesces into a single scheduled frame.
    expect(raf).toHaveBeenCalledTimes(1);
    expect(result.current?.client.x).toBe(10);

    act(() => flush());

    // One update for the coalesced tail, reflecting the most recent event.
    expect(result.current?.client.x).toBe(30);
    expect((result.current?.target as HTMLElement).tagName).toBe('CANVAS');

    canvas.remove();
    restore();
  });

  it('should update synchronously on the first move onto a canvas without waiting for a frame', () => {
    const { raf, restore } = mockAnimationFrame();
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    const { result } = renderHook(() => useMousePosition());

    act(() => dispatchMove(canvas, 42));

    expect(result.current?.client.x).toBe(42);
    expect((result.current?.target as HTMLElement).tagName).toBe('CANVAS');
    expect(raf).not.toHaveBeenCalled();

    canvas.remove();
    restore();
  });

  it('should scope the snapshot to the chart whose canvas is hovered when a chart ref is provided', () => {
    const { flush, restore } = mockAnimationFrame();
    const containerA = document.createElement('div');
    const canvasA = document.createElement('canvas');
    containerA.appendChild(canvasA);
    const containerB = document.createElement('div');
    const canvasB = document.createElement('canvas');
    containerB.appendChild(canvasB);
    document.body.append(containerA, containerB);

    const chartRefA = { current: { getDom: (): HTMLElement => containerA } };
    const chartRefB = { current: { getDom: (): HTMLElement => containerB } };
    const hookA = renderHook(() => useMousePosition(chartRefA));
    const hookB = renderHook(() => useMousePosition(chartRefB));

    act(() => dispatchMove(canvasA, 10)); // canvas-enter flushes synchronously

    expect(hookA.result.current?.client.x).toBe(10);
    expect(hookB.result.current).toBeNull();

    // Crossing straight from chart A onto chart B hands the coords over: A hides, B shows.
    act(() => dispatchMove(canvasB, 20)); // canvas-to-canvas is frame-coalesced
    act(() => flush());

    expect(hookA.result.current).toBeNull();
    expect(hookB.result.current?.client.x).toBe(20);

    containerA.remove();
    containerB.remove();
    restore();
  });

  it('should not re-render subscribers scoped to other charts while one chart is hovered', () => {
    const { flush, restore } = mockAnimationFrame();
    const containerA = document.createElement('div');
    const canvasA = document.createElement('canvas');
    containerA.appendChild(canvasA);
    const containerB = document.createElement('div');
    const canvasB = document.createElement('canvas');
    containerB.appendChild(canvasB);
    document.body.append(containerA, containerB);

    const chartRefA = { current: { getDom: (): HTMLElement => containerA } };
    const chartRefB = { current: { getDom: (): HTMLElement => containerB } };
    let rendersB = 0;
    const hookA = renderHook(() => useMousePosition(chartRefA));
    const hookB = renderHook(() => {
      rendersB += 1;
      return useMousePosition(chartRefB);
    });
    const initialRendersB = rendersB;

    act(() => dispatchMove(canvasA, 10)); // enter: synchronous
    act(() => dispatchMove(canvasA, 20)); // frame-coalesced
    act(() => flush());

    expect(hookA.result.current?.client.x).toBe(20);
    expect(hookB.result.current).toBeNull();
    // B's snapshot stayed null the whole time, so useSyncExternalStore never re-rendered it.
    expect(rendersB).toBe(initialRendersB);

    containerA.remove();
    containerB.remove();
    restore();
  });

  it('should share a single window mousemove listener across all subscribers', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    const chartRef = { current: { getDom: (): HTMLElement => document.body } };

    const hookA = renderHook(() => useMousePosition());
    const hookB = renderHook(() => useMousePosition(chartRef));

    const addedMousemoveListeners = addSpy.mock.calls.filter(([type]) => type === 'mousemove');
    expect(addedMousemoveListeners).toHaveLength(1);

    hookA.unmount();
    expect(removeSpy.mock.calls.filter(([type]) => type === 'mousemove')).toHaveLength(0);

    hookB.unmount(); // last subscriber gone -> listener removed
    expect(removeSpy.mock.calls.filter(([type]) => type === 'mousemove')).toHaveLength(1);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('should flush synchronously again when re-entering a canvas after leaving', () => {
    const { flush, restore } = mockAnimationFrame();
    const canvas = document.createElement('canvas');
    const div = document.createElement('div');
    document.body.appendChild(canvas);
    document.body.appendChild(div);

    const { result } = renderHook(() => useMousePosition());

    act(() => dispatchMove(canvas, 10)); // enter: synchronous
    act(() => dispatchMove(div, 11)); // leave: frame-coalesced
    act(() => flush());
    expect((result.current?.target as HTMLElement).tagName).toBe('DIV');

    act(() => dispatchMove(canvas, 12)); // re-enter: synchronous again
    expect(result.current?.client.x).toBe(12);
    expect((result.current?.target as HTMLElement).tagName).toBe('CANVAS');

    canvas.remove();
    div.remove();
    restore();
  });

  it('should not update coordinates while the cursor stays off any chart canvas', () => {
    const { flush, restore } = mockAnimationFrame();
    const div = document.createElement('div');
    document.body.appendChild(div);

    const { result } = renderHook(() => useMousePosition());

    act(() => dispatchMove(div, 5));
    act(() => flush());

    expect(result.current).toBeNull();

    div.remove();
    restore();
  });

  // LOGZ.IO ADDITION:: scroll must hide the tooltip and mute browser-synthesized hover [unidash-perf]
  it('should hide the tooltip when the page scrolls', () => {
    const { restore } = mockAnimationFrame();
    const nowSpy = jest.spyOn(performance, 'now').mockReturnValue(100);
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    const { result, unmount } = renderHook(() => useMousePosition());

    act(() => dispatchMove(canvas, 10)); // enter: synchronous
    expect(result.current?.client.x).toBe(10);

    act(() => {
      canvas.dispatchEvent(new Event('scroll')); // scroll doesn't bubble; the store listens in capture phase
    });

    expect(result.current).toBeNull();

    unmount();
    nowSpy.mockRestore();
    canvas.remove();
    restore();
  });

  it('should ignore browser-synthesized moves during the scroll cooldown and resume after it', () => {
    const { restore } = mockAnimationFrame();
    const nowSpy = jest.spyOn(performance, 'now').mockReturnValue(100);
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    const { result, unmount } = renderHook(() => useMousePosition());

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    // the post-scroll synthetic move lands within the cooldown -> ignored, no tooltip
    nowSpy.mockReturnValue(200);
    act(() => dispatchMove(canvas, 10));
    expect(result.current).toBeNull();

    // once scrolling has settled, real moves work again (canvas-enter flushes synchronously)
    nowSpy.mockReturnValue(500);
    act(() => dispatchMove(canvas, 20));
    expect(result.current?.client.x).toBe(20);

    unmount();
    nowSpy.mockRestore();
    canvas.remove();
    restore();
  });

  it('should emit a single update when the cursor leaves the canvas, then ignore further off-canvas moves', () => {
    const { flush, restore } = mockAnimationFrame();
    const canvas = document.createElement('canvas');
    const div = document.createElement('div');
    document.body.appendChild(canvas);
    document.body.appendChild(div);

    const { result } = renderHook(() => useMousePosition());

    // Hovering the canvas emits canvas coords (synchronously on enter; flush is a no-op here).
    act(() => dispatchMove(canvas, 10));
    act(() => flush());
    expect((result.current?.target as HTMLElement).tagName).toBe('CANVAS');

    // Leaving the canvas emits one update so the consumer can hide the tooltip.
    act(() => dispatchMove(div, 11));
    act(() => flush());
    expect((result.current?.target as HTMLElement).tagName).toBe('DIV');

    // Continuing to move over non-chart elements produces no further state changes.
    act(() => dispatchMove(div, 12));
    act(() => flush());
    expect(result.current?.client.x).toBe(11);

    canvas.remove();
    div.remove();
    restore();
  });
});
