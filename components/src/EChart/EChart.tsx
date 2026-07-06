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

import { CSSProperties, memo, useEffect, useLayoutEffect, useRef } from 'react';
import { ECharts, EChartsCoreOption, init, connect, use } from 'echarts/core';
import { Box, SxProps, Theme } from '@mui/material';
import isEqual from 'lodash/isEqual';
import debounce from 'lodash/debounce';

import {
  BarChart as EChartsBarChart,
  LineChart as EChartsLineChart,
  GaugeChart as EChartsGaugeChart,
  PieChart as EChartsPieChart,
  ScatterChart as EChartsScatterChart,
  CustomChart as EChartsCustomChart,
  HeatmapChart as EChartsHeatmapChart,
} from 'echarts/charts';
import {
  DatasetComponent,
  DataZoomComponent,
  LegendComponent,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  ToolboxComponent,
  MarkPointComponent,
  MarkAreaComponent,
  MarkLineComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { clearNearbySeriesDispatchCache } from '../utils/chart-actions'; // LOGZ.IO CHANGE:: reset emphasis-dispatch dedup on option replace [unidash-perf]
import { EChartsTheme } from '../model';

// Loading the ECharts extensions should happen in the respective plugins.
// This is a workaround for https://github.com/perses/plugins/issues/83.
use([
  DatasetComponent,
  DataZoomComponent,
  LegendComponent,
  EChartsBarChart,
  EChartsLineChart,
  EChartsGaugeChart,
  EChartsPieChart,
  EChartsScatterChart,
  EChartsCustomChart,
  EChartsHeatmapChart,
  GridComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  CanvasRenderer,
  VisualMapComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
]);

// LOGZ.IO CHANGE START:: suspend chart hit-testing while the page scrolls [unidash-perf]
// After a scroll, the browser re-hit-tests the element under the (stationary) cursor and dispatches
// pointerover/enter/leave + mousemove to whatever chart scrolled underneath it. Those events run the
// full hover pipeline (zrender hover state, axis pointer, emphasis, tooltip render) — measured at
// 200-260ms per handler burst during dashboard scrolling. Turning pointer-events off on every chart
// container for the duration of the scroll (plus a short cooldown) suppresses all of it at the
// browser level; the styles are restored as soon as scrolling settles.
const SCROLL_POINTER_RESUME_MS = 250;
const scrollSuspendTargets = new Set<HTMLElement>();
let scrollSuspendListenerAttached = false;
let scrollSuspendActive = false;
let scrollSuspendRestoreTimer: ReturnType<typeof setTimeout> | undefined;

function handleScrollSuspend(): void {
  if (!scrollSuspendActive) {
    scrollSuspendActive = true;
    scrollSuspendTargets.forEach((el) => {
      el.style.pointerEvents = 'none';
    });
  }
  if (scrollSuspendRestoreTimer !== undefined) clearTimeout(scrollSuspendRestoreTimer);
  scrollSuspendRestoreTimer = setTimeout(() => {
    scrollSuspendActive = false;
    scrollSuspendRestoreTimer = undefined;
    scrollSuspendTargets.forEach((el) => {
      el.style.pointerEvents = '';
    });
  }, SCROLL_POINTER_RESUME_MS);
}

function registerScrollSuspendTarget(el: HTMLElement): () => void {
  scrollSuspendTargets.add(el);
  if (!scrollSuspendListenerAttached) {
    window.addEventListener('scroll', handleScrollSuspend, { capture: true, passive: true });
    scrollSuspendListenerAttached = true;
  }
  if (scrollSuspendActive) el.style.pointerEvents = 'none';

  return (): void => {
    scrollSuspendTargets.delete(el);
    el.style.pointerEvents = '';
    if (scrollSuspendTargets.size === 0 && scrollSuspendListenerAttached) {
      window.removeEventListener('scroll', handleScrollSuspend, true);
      scrollSuspendListenerAttached = false;
      if (scrollSuspendRestoreTimer !== undefined) {
        clearTimeout(scrollSuspendRestoreTimer);
        scrollSuspendRestoreTimer = undefined;
      }
      scrollSuspendActive = false;
    }
  };
}
// LOGZ.IO CHANGE END:: suspend chart hit-testing while the page scrolls [unidash-perf]

// see docs for info about each property: https://echarts.apache.org/en/api.html#events
export interface MouseEventsParameters<T> {
  componentType: string;
  seriesType: string;
  seriesIndex: number;
  seriesName: string;
  name: string;
  dataIndex: number;
  data: Record<string, unknown> & T;
  dataType: string;
  value: number | number[];
  color: string;
  info: Record<string, unknown>;
}

type OnEventFunction<T> = (
  params: MouseEventsParameters<T>,
  // This is potentially undefined for testing purposes
  instance?: ECharts
) => void;

const mouseEvents = [
  'click',
  'dblclick',
  'mousedown',
  'mousemove',
  'mouseup',
  'mouseover',
  'mouseout',
  'globalout',
  'contextmenu',
] as const;

export type MouseEventName = (typeof mouseEvents)[number];

// batch event types
export interface DataZoomPayloadBatchItem {
  dataZoomId: string;
  // start and end not returned unless dataZoom is based on percentProp,
  // which is for cases when a dataZoom component controls multiple axes
  start?: number;
  end?: number;
  // startValue and endValue return data index for 'category' axes,
  // for axis types 'value' and 'time', actual values are returned
  startValue?: number;
  endValue?: number;
}

export interface HighlightPayloadBatchItem {
  dataIndex: number;
  dataIndexInside: number;
  seriesIndex: number;
  // highlight action can effect multiple connected charts
  escapeConnect?: boolean;
  // whether blur state was triggered
  notBlur?: boolean;
}

export interface BatchEventsParameters {
  type: BatchEventName;
  batch: DataZoomPayloadBatchItem[] & HighlightPayloadBatchItem[];
}

type OnBatchEventFunction = (params: BatchEventsParameters) => void;

const batchEvents = ['datazoom', 'downplay', 'highlight'] as const;

export type BatchEventName = (typeof batchEvents)[number];

type ChartEventName = 'finished';

type EventName = MouseEventName | ChartEventName | BatchEventName;

export type OnEventsType<T> = {
  [mouseEventName in MouseEventName]?: OnEventFunction<T>;
} & {
  [batchEventName in BatchEventName]?: OnBatchEventFunction;
} & {
  [eventName in ChartEventName]?: () => void;
};

export interface EChartsProps<T> {
  option: EChartsCoreOption;
  theme?: string | EChartsTheme;
  renderer?: 'canvas' | 'svg';
  sx?: SxProps<Theme>;
  style?: CSSProperties;
  onEvents?: OnEventsType<T>;
  _instance?: React.MutableRefObject<ECharts | undefined>;
  syncGroup?: string;
  onChartInitialized?: (instance: ECharts) => void;
}

export const EChart = memo(function EChart<T>({
  option,
  theme,
  renderer,
  sx,
  style,
  onEvents,
  _instance,
  syncGroup,
  onChartInitialized,
}: EChartsProps<T>) {
  const initialOption = useRef<EChartsCoreOption>(option);
  const prevOption = useRef<EChartsCoreOption>(option);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartElement = useRef<ECharts | null>(null);

  // Initialize chart, dispose on unmount
  useLayoutEffect(() => {
    if (containerRef.current === null || chartElement.current !== null) return;
    // LOGZ.IO CHANGE START:: enable dirty-rectangle rendering so zrender only repaints the changed
    // canvas regions (crosshair, hover, partial updates) instead of the whole canvas — cuts main-thread
    // paint cost on dense panels. [unidash-perf]
    chartElement.current = init(containerRef.current, theme, {
      renderer: renderer ?? 'canvas',
      useDirtyRect: true,
    });
    // LOGZ.IO CHANGE END:: enable dirty-rectangle rendering [unidash-perf]
    if (chartElement.current === undefined) return;
    chartElement.current.setOption(initialOption.current, true);
    onChartInitialized?.(chartElement.current);
    if (_instance !== undefined) {
      _instance.current = chartElement.current;
    }
    return (): void => {
      if (chartElement.current === null) return;
      // LOGZ.IO CHANGE START:: pre-dispose cleanup [unidash-perf]
      // Pending tooltip timers (ECharts' internal _keepShow setTimeout) and sync-group linkage keep
      // referencing the instance graph — its canvas, zrender tree and cloned dataset — after unmount.
      // Leak tracking showed unmounted chart canvases surviving forced GC after panel-group
      // collapse/expand cycles (~150MB retained per cycle). Drop the tooltip and leave the sync
      // group before disposing so no timer/registry closure retains the chart.
      try {
        chartElement.current.dispatchAction({ type: 'hideTip' });
      } catch {
        // best-effort: never block dispose
      }
      chartElement.current.group = '';
      // LOGZ.IO CHANGE END:: pre-dispose cleanup [unidash-perf]
      chartElement.current.dispose();
      chartElement.current = null;
      // LOGZ.IO CHANGE START:: don't leave parent refs pointing at the disposed instance — a disposed
      // chart still references its DOM/canvas, so any longer-lived holder of this ref would retain the
      // whole chart graph after unmount. [unidash-perf]
      if (_instance !== undefined) {
        _instance.current = undefined;
      }
      // LOGZ.IO CHANGE END:: clear escaped instance refs [unidash-perf]
    };
  }, [_instance, onChartInitialized, theme, renderer]);

  // LOGZ.IO CHANGE START:: suspend chart hit-testing while the page scrolls [unidash-perf]
  useLayoutEffect(() => {
    if (containerRef.current === null) return;

    return registerScrollSuspendTarget(containerRef.current);
  }, []);
  // LOGZ.IO CHANGE END:: suspend chart hit-testing while the page scrolls [unidash-perf]

  // When syncGroup is explicitly set, charts within same group share interactions such as crosshair
  useEffect(() => {
    if (!chartElement.current || !syncGroup) return;
    const chart = chartElement.current; // LOGZ.IO CHANGE:: capture for cleanup [unidash-perf]
    chart.group = syncGroup;
    connect([chart]); // more info: https://echarts.apache.org/en/api.html#echarts.connect
    // LOGZ.IO CHANGE START:: leave the sync group when it changes or the chart unmounts, so the
    // group registry never keeps a reference to a disposed chart. [unidash-perf]
    return (): void => {
      if (!chart.isDisposed()) {
        chart.group = '';
      }
    };
    // LOGZ.IO CHANGE END:: leave the sync group [unidash-perf]
  }, [syncGroup, chartElement]);

  // Update chart data when option changes
  useEffect(() => {
    if (prevOption.current === undefined || isEqual(prevOption.current, option)) return;
    if (!chartElement.current) return;
    chartElement.current.setOption(option, true);
    // LOGZ.IO CHANGE:: replacing the option resets series states, so the emphasis-dispatch dedup
    // cache must forget its last payload or an identical follow-up dispatch would be skipped. [unidash-perf]
    clearNearbySeriesDispatchCache(chartElement.current);
    prevOption.current = option;
  }, [option]);

  // Resize chart, cleanup listener on unmount
  useLayoutEffect(() => {
    const updateSize = debounce(() => {
      if (!chartElement.current) return;
      chartElement.current.resize();
    }, 200);
    window.addEventListener('resize', updateSize);
    updateSize();
    return (): void => {
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Bind and unbind chart events passed as prop
  useEffect(() => {
    const chart = chartElement.current;
    if (!chart || onEvents === undefined) return;
    bindEvents(chart, onEvents);
    return (): void => {
      if (chart === undefined) return;
      if (chart.isDisposed() === true) return;
      for (const event in onEvents) {
        chart.off(event);
      }
    };
  }, [onEvents]);

  // LOGZ.IO CHANGE START:: APPZ-359-unidash-performance-issues-when-loading-high-number-of-serieses
  useEffect(() => {
    if (!containerRef.current) return;

    let rafId: number;

    const resizeObserver = new ResizeObserver(() => {
      if (chartElement.current) {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          chartElement.current?.resize();
        });
      }
    });

    resizeObserver.observe(containerRef.current);

    return (): void => {
      resizeObserver.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, []);
  // LOGZ.IO CHANGE END:: APPZ-359-unidash-performance-issues-when-loading-high-number-of-serieses

  return <Box ref={containerRef} sx={sx} style={style}></Box>;
});

// Validate event config and bind custom events
function bindEvents<T>(instance: ECharts, events?: OnEventsType<T>): void {
  if (events === undefined) return;

  function bindEvent(eventName: EventName, OnEventFunction: unknown): void {
    if (typeof OnEventFunction === 'function') {
      if (isMouseEvent(eventName)) {
        instance.on(eventName, (params) => OnEventFunction(params, instance));
      } else if (isBatchEvent(eventName)) {
        instance.on(eventName, (params) => OnEventFunction(params));
      } else {
        instance.on(eventName, () => OnEventFunction(null, instance));
      }
    }
  }

  for (const eventName in events) {
    if (Object.prototype.hasOwnProperty.call(events, eventName)) {
      const customEvent = events[eventName as EventName] ?? null;
      if (customEvent) {
        bindEvent(eventName as EventName, customEvent);
      }
    }
  }
}

function isMouseEvent(eventName: EventName): eventName is MouseEventName {
  return (mouseEvents as readonly string[]).includes(eventName);
}

function isBatchEvent(eventName: EventName): eventName is BatchEventName {
  return (batchEvents as readonly string[]).includes(eventName);
}
