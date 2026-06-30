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

    // Three events in a burst, but only one frame is scheduled and no state update yet.
    expect(raf).toHaveBeenCalledTimes(1);
    expect(result.current).toBeNull();

    act(() => flush());

    // One update, reflecting the most recent event.
    expect(result.current?.client.x).toBe(30);
    expect((result.current?.target as HTMLElement).tagName).toBe('CANVAS');

    canvas.remove();
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

  it('should emit a single update when the cursor leaves the canvas, then ignore further off-canvas moves', () => {
    const { flush, restore } = mockAnimationFrame();
    const canvas = document.createElement('canvas');
    const div = document.createElement('div');
    document.body.appendChild(canvas);
    document.body.appendChild(div);

    const { result } = renderHook(() => useMousePosition());

    // Hovering the canvas emits canvas coords.
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
