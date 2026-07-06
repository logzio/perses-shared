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

import { TimeSeries, TimeSeriesValueTuple } from '@perses-dev/spec';
import { ECharts as EChartsInstance } from 'echarts/core';
import { DatapointInfo } from '../model';
import {
  batchDispatchNearbySeriesActions,
  clearNearbySeriesDispatchCache,
  getClosestTimestamp,
  getClosestTimestampInFullDataset,
  getPointInGrid,
} from './chart-actions';

const TEST_TIME_SERIES_VALUES: TimeSeriesValueTuple[] = [
  [1690381125000, 0.12],
  [1690381140000, 0.12],
  [1690381155000, 0.13],
  [1690381170000, 0.13],
  [1690381185000, 0.14],
  [1690381200000, 0.14],
  [1690381215000, 0.16],
  [1690381230000, 0.16],
  [1690381245000, 0.16],
  [1690381260000, 0.16],
  [1690381275000, 0.16],
  [1690381290000, 0.15],
  [1690381305000, 0.15],
  [1690381320000, 0.16],
  [1690381335000, 0.17],
  [1690381350000, 0.17],
  [1690381365000, 0.17],
  [1690381380000, 0.16],
  [1690381395000, 0.16],
  [1690381410000, 0.16],
  [1690381425000, 0.15],
];

const TEST_TIME_SERIES_DATA: TimeSeries[] = [
  {
    name: 'node_network_transmit_queue_length{device="eth0",env="demo",instance="demo.do.prometheus.io:9100",job="node"}',
    values: [
      [1690386135000, 1000],
      [1690386150000, 1000],
      [1690386165000, 1000],
      [1690386180000, 1000],
      [1690386195000, 1000],
      [1690386210000, 1000],
      [1690386225000, 1000],
      [1690386240000, 1000],
      [1690386255000, 1000],
      [1690386270000, 1000],
      [1690386285000, 1000],
      [1690386300000, 1000],
      [1690386315000, 1000],
      [1690386330000, 1000],
      [1690386345000, 1000],
      [1690386360000, 1000],
      [1690386375000, 1000],
      [1690386390000, 1000],
      [1690386405000, 1000],
      [1690386420000, 1000],
      [1690386435000, 1000],
    ],
  },
  {
    name: 'node_network_transmit_queue_length{device="lo",env="demo",instance="demo.do.prometheus.io:9100",job="node"}',
    values: [
      [1690386135000, 1000],
      [1690386150000, 1000],
      [1690386165000, 1000],
      [1690386180000, 1000],
      [1690386195000, 1000],
      [1690386210000, 1000],
      [1690386225000, 1000],
      [1690386240000, 1000],
      [1690386255000, 1000],
      [1690386270000, 1000],
      [1690386285000, 1000],
      [1690386300000, 1000],
      [1690386315000, 1000],
      [1690386330000, 1000],
      [1690386345000, 1000],
      [1690386360000, 1000],
      [1690386375000, 1000],
      [1690386390000, 1000],
      [1690386405000, 1000],
      [1690386420000, 1000],
      [1690386435000, 1000],
    ],
  },
  {
    name: 'Threshold 1',
    values: [
      [1690386135000, 300],
      [1690386150000, 300],
      [1690386165000, 300],
      [1690386180000, 300],
      [1690386195000, 300],
      [1690386210000, 300],
      [1690386225000, 300],
      [1690386240000, 300],
      [1690386255000, 300],
      [1690386270000, 300],
      [1690386285000, 300],
      [1690386300000, 300],
      [1690386315000, 300],
      [1690386330000, 300],
      [1690386345000, 300],
      [1690386360000, 300],
      [1690386375000, 300],
      [1690386390000, 300],
      [1690386405000, 300],
      [1690386420000, 300],
      [1690386435000, 300],
    ],
  },
];

describe('getClosestTimestamp', () => {
  it('should determine closest timestamp to current cursor xValue in single dataset source', () => {
    expect(getClosestTimestamp(TEST_TIME_SERIES_VALUES, 1690381320276.3362)).toEqual(1690381320000);
  });

  it('should return null when no time series values', () => {
    expect(getClosestTimestamp([], 1690381320276.3362)).toEqual(null);
  });

  it('should return null when undefined cursorX param', () => {
    expect(getClosestTimestamp(TEST_TIME_SERIES_VALUES)).toEqual(null);
  });
});

describe('getClosestTimestampInFullDataset', () => {
  it('should determine closest timestamp to current cursor xValue in full time series data', () => {
    expect(getClosestTimestampInFullDataset(TEST_TIME_SERIES_DATA, 1690386199722.634)).toEqual(1690386195000);
  });
});

// LOGZ.IO ADDITION:: edge-halo tolerance around the plot rect [APPZ-2907]
describe('getPointInGrid', () => {
  const GRID_RECT = { x: 40, y: 10, width: 400, height: 200 }; // grid spans x: 40-440, y: 10-210

  const buildFakeChart = (withModel = true): EChartsInstance =>
    ({
      containPixel: (_finder: unknown, point: number[]): boolean => {
        const [x = NaN, y = NaN] = point;
        return (
          x >= GRID_RECT.x &&
          x <= GRID_RECT.x + GRID_RECT.width &&
          y >= GRID_RECT.y &&
          y <= GRID_RECT.y + GRID_RECT.height
        );
      },
      // identity conversion so assertions can observe the (possibly clamped) pixel input
      convertFromPixel: (_finder: unknown, point: number[]): number[] => [...point],
      ...(withModel
        ? { _model: { getComponent: (): unknown => ({ coordinateSystem: { getRect: (): unknown => GRID_RECT } }) } }
        : {}),
    }) as unknown as EChartsInstance;

  it('should convert points inside the grid unchanged', () => {
    expect(getPointInGrid(100, 50, buildFakeChart())).toEqual([100, 50]);
  });

  it('should clamp cursor positions within the edge tolerance onto the plot rect', () => {
    // 2px left of the grid: series strokes render there, so the tooltip should snap to the edge
    expect(getPointInGrid(38, 50, buildFakeChart())).toEqual([40, 50]);
    // 2px below the bottom edge
    expect(getPointInGrid(100, 212, buildFakeChart())).toEqual([100, 210]);
    // corner: slightly out on both axes
    expect(getPointInGrid(441, 211, buildFakeChart())).toEqual([440, 210]);
  });

  it('should return null when the cursor is beyond the edge tolerance', () => {
    // 3px miss: just past the 2px tolerance
    expect(getPointInGrid(37, 50, buildFakeChart())).toBeNull();
    expect(getPointInGrid(30, 50, buildFakeChart())).toBeNull();
    expect(getPointInGrid(100, 220, buildFakeChart())).toBeNull();
  });

  it('should return null outside the grid when the chart model is unavailable', () => {
    expect(getPointInGrid(38, 50, buildFakeChart(false))).toBeNull();
  });

  it('should return null when no chart is provided', () => {
    expect(getPointInGrid(100, 50, undefined)).toBeNull();
  });
});

// LOGZ.IO ADDITION:: emphasis-dispatch dedup — identical consecutive payloads must not re-trigger
// ECharts state processing and repaints on every mousemove [unidash-perf]
describe('batchDispatchNearbySeriesActions', () => {
  const buildChart = (): EChartsInstance => ({ dispatchAction: jest.fn() }) as unknown as EChartsInstance;

  const emphasizedDatapoint: DatapointInfo = { seriesIndex: 0, dataIndex: 5, seriesName: 'a', yValue: 1 };

  it('should dispatch select, downplay and highlight for a new payload', () => {
    const chart = buildChart();

    batchDispatchNearbySeriesActions(chart, [0, 1], [0], [1], [emphasizedDatapoint], []);

    expect(chart.dispatchAction).toHaveBeenCalledTimes(3);
  });

  it('should skip dispatching when the payload is identical to the previous move', () => {
    const chart = buildChart();

    batchDispatchNearbySeriesActions(chart, [0, 1], [0], [1], [emphasizedDatapoint], []);
    batchDispatchNearbySeriesActions(chart, [0, 1], [0], [1], [emphasizedDatapoint], []);

    expect(chart.dispatchAction).toHaveBeenCalledTimes(3);
  });

  it('should dispatch again when the payload changes', () => {
    const chart = buildChart();

    batchDispatchNearbySeriesActions(chart, [0, 1], [0], [1], [emphasizedDatapoint], []);
    batchDispatchNearbySeriesActions(chart, [0, 1], [1], [0], [emphasizedDatapoint], []);

    expect(jest.mocked(chart.dispatchAction).mock.calls.length).toBeGreaterThan(3);
  });

  it('should dispatch an identical payload again after the cache is cleared for the chart', () => {
    const chart = buildChart();

    batchDispatchNearbySeriesActions(chart, [0, 1], [0], [1], [emphasizedDatapoint], []);
    clearNearbySeriesDispatchCache(chart);
    batchDispatchNearbySeriesActions(chart, [0, 1], [0], [1], [emphasizedDatapoint], []);

    expect(chart.dispatchAction).toHaveBeenCalledTimes(6);
  });

  it('should keep dedup state per chart instance', () => {
    const chartA = buildChart();
    const chartB = buildChart();

    batchDispatchNearbySeriesActions(chartA, [0], [], [0], [], []);
    batchDispatchNearbySeriesActions(chartB, [0], [], [0], [], []);

    // Payload with no emphasis dispatches downplay + highlight + toggleSelect on each chart.
    expect(chartA.dispatchAction).toHaveBeenCalledTimes(3);
    expect(chartB.dispatchAction).toHaveBeenCalledTimes(3);
  });
});
