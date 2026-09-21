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

// LOGZ.IO ADDITION:: guards the chart teardown path — pending tooltip timers must be released before
// dispose, otherwise unmounted charts survive GC (memory leak). [unidash-perf]

import { render } from '@testing-library/react';
import { EChart } from './EChart';

// LOGZ.IO CHANGE:: the zrender instance, whose flush paints the pending option
const fakeZr = { flush: jest.fn() };

const fakeChart = {
  group: '',
  setOption: jest.fn(),
  dispose: jest.fn(),
  dispatchAction: jest.fn(),
  isDisposed: jest.fn(() => false),
  resize: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  getZr: jest.fn(() => fakeZr), // LOGZ.IO CHANGE
  // LOGZ.IO CHANGE:: `enableDataZoom` reads the toolbox state off the model, the same way the real
  // chart exposes it. An unrendered toolbox has no `iconStatus`.
  _model: { option: { toolbox: [{ feature: { dataZoom: {} } }] } },
};

jest.mock('echarts/core', () => ({
  init: jest.fn(() => fakeChart),
  use: jest.fn(),
}));

// jsdom has no ResizeObserver (EChart observes its container for panel resizes)
class ResizeObserverStub {
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}

(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;

// jsdom has no IntersectionObserver; components under test may construct one.
class IntersectionObserverStub {
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}

(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = IntersectionObserverStub;

describe('EChart', () => {
  it('should hide the tooltip before disposing on unmount', () => {
    fakeChart.group = '';
    fakeChart.dispose.mockClear();
    fakeChart.dispatchAction.mockClear();

    const { unmount } = render(<EChart option={{}} />);

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

  // LOGZ.IO ADDITION:: charts no longer join an ECharts connect group — the crosshair they used to
  // share through it is drawn by ChartCrosshair from a shared timestamp. [unidash-perf]
  it('should never join an ECharts connect group', () => {
    fakeChart.group = '';

    render(<EChart option={{}} />);

    expect(fakeChart.group).toBe('');
  });

  // LOGZ.IO ADDITION:: skip the deep option compare when the option object is unchanged [unidash-perf]
  it('should not re-apply the option when the same object is rendered again', () => {
    const option = { series: [] };
    const { rerender } = render(<EChart option={option} />);

    fakeChart.setOption.mockClear();
    rerender(<EChart option={option} />);

    expect(fakeChart.setOption).not.toHaveBeenCalled();
  });

  // LOGZ.IO CHANGE START:: drag-to-zoom is armed with the option
  // Applying an option rebuilds the component views, and the armed state of the zoom toolbox lives
  // on the view that is thrown away — so the arm belongs to the option, not to the chart instance.
  describe('drag-to-zoom arming', () => {
    const ZOOM_OPTION = { toolbox: { feature: { dataZoom: { yAxisIndex: 'none' } } }, series: [] };
    const NO_DATA_OPTION = { title: { text: 'No data' }, xAxis: { show: false } };
    const armingAction = expect.objectContaining({ type: 'takeGlobalCursor', dataZoomSelectActive: true });

    const clearCalls = (): void => {
      fakeChart.setOption.mockClear();
      fakeChart.dispatchAction.mockClear();
      fakeZr.flush.mockClear();
    };

    it('should arm drag-to-zoom in the same chart update as the option it belongs to', () => {
      clearCalls();

      render(<EChart option={ZOOM_OPTION} enableDataZoomSelect />);

      // A lazy option leaves the update pending; the dispatch that follows is what carries it out,
      // so the chart renders once instead of twice.
      expect(fakeChart.setOption).toHaveBeenCalledWith(ZOOM_OPTION, { notMerge: true, lazyUpdate: true });
      expect(fakeChart.dispatchAction).toHaveBeenCalledWith(armingAction);
      expect(fakeChart.dispatchAction.mock.invocationCallOrder[0]).toBeGreaterThan(
        fakeChart.setOption.mock.invocationCallOrder[0] ?? Infinity
      );
    });

    // A plain `setOption` paints before it returns; the dispatch that carries out a lazy one does
    // not, which would leave a backgrounded chart showing the previous frame.
    it('should paint the lazily applied option rather than leave it for a later frame', () => {
      clearCalls();

      render(<EChart option={ZOOM_OPTION} enableDataZoomSelect />);

      expect(fakeZr.flush).toHaveBeenCalledTimes(1);
      expect(fakeZr.flush.mock.invocationCallOrder[0]).toBeGreaterThan(
        fakeChart.dispatchAction.mock.invocationCallOrder[0] ?? Infinity
      );
    });

    it('should re-arm drag-to-zoom on every option replacement, not once per chart', () => {
      const { rerender } = render(<EChart option={ZOOM_OPTION} enableDataZoomSelect />);

      clearCalls();
      rerender(<EChart option={{ ...ZOOM_OPTION, series: [{ type: 'line' }] }} enableDataZoomSelect />);

      expect(fakeChart.setOption).toHaveBeenCalledTimes(1);
      expect(fakeChart.dispatchAction).toHaveBeenCalledWith(armingAction);
    });

    it('should apply an option with no zoom toolbox outright, since there is nothing to arm', () => {
      clearCalls();

      render(<EChart option={NO_DATA_OPTION} enableDataZoomSelect />);

      expect(fakeChart.setOption).toHaveBeenCalledWith(NO_DATA_OPTION, true);
      expect(fakeChart.dispatchAction).not.toHaveBeenCalled();
    });

    it('should not touch the global cursor of a chart that did not ask for drag-to-zoom', () => {
      clearCalls();

      render(<EChart option={ZOOM_OPTION} />);

      expect(fakeChart.setOption).toHaveBeenCalledWith(ZOOM_OPTION, true);
      expect(fakeChart.dispatchAction).not.toHaveBeenCalled();
    });
  });
  // LOGZ.IO CHANGE END:: drag-to-zoom is armed with the option
});
