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

import { ECharts as EChartsInstance } from 'echarts/core';
import { TimeSeries, TimeSeriesValueTuple } from '@perses-dev/spec';
import { DatapointInfo, PINNED_CROSSHAIR_SERIES_NAME, TimeChartSeriesMapping } from '../model';

export interface ZoomEventData {
  start: number;
  end: number;
}

/**
 * Enable dataZoom without requring user to click toolbox icon.
 * https://stackoverflow.com/questions/57183297/is-there-a-way-to-use-zoom-of-type-select-without-showing-the-toolbar
 */
export function enableDataZoom(chart: EChartsInstance): void {
  const chartModel = chart['_model'];
  if (chartModel === undefined) return;
  if (chartModel.option.toolbox !== undefined && chartModel.option.toolbox.length > 0) {
    // check if hidden data zoom icon is unselected (if selected it would be 'emphasis' instead of 'normal')
    if (chartModel.option.toolbox[0].feature.dataZoom.iconStatus.zoom === 'normal') {
      chart.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'dataZoomSelect',
        dataZoomSelectActive: true,
        // LOGZ.IO CHANGE:: arming drag-to-zoom is local to this chart, but ECharts registers
        // takeGlobalCursor with `update: 'update'` and a connect group re-dispatches it to every
        // member — so without this each panel entry ran a full update on every synced chart. [unidash-perf]
        escapeConnect: true,
      });
    }
  }
}

/**
 * Restore chart to original state before zoom or other actions were dispatched
 */
export function restoreChart(chart: EChartsInstance): void {
  // TODO: support incremental unzoom instead of restore to original state
  chart.dispatchAction({
    type: 'restore', // https://echarts.apache.org/en/api.html#events.restore
  });
}

/*
 * Clear all highlighted series when cursor exits canvas
 * https://echarts.apache.org/en/api.html#action.downplay
 */
export function clearHighlightedSeries(chart: EChartsInstance): void {
  if (chart.dispatchAction !== undefined) {
    // LOGZ.IO CHANGE:: `escapeConnect` on both — this runs when the cursor leaves THIS panel, so
    // broadcasting it forced every other synced chart to reprocess emphasis state and repaint on
    // every panel boundary the cursor crossed. [unidash-perf]
    // Clear any selected data points
    chart.dispatchAction({
      type: 'unselect',
      escapeConnect: true,
    });

    // Clear any highlighted series
    chart.dispatchAction({
      type: 'downplay',
      escapeConnect: true,
    });
  }
}

// LOGZ.IO CHANGE START:: tolerate cursor positions a couple px outside the plot rect
// ECharts expands the line-series clip rect by the stroke width so boundary-hugging series aren't cut
// off, and zrender hit-tests that spill: in a ~1-2px halo around the plot the cursor turns into a
// pointer and the line shows its hover emphasis, but a strict containPixel check silently hid the
// tooltip (and blocked pin-on-click). Cursor positions within this tolerance are clamped onto the rect.
const GRID_EDGE_TOLERANCE_PX = 2;

export interface GridRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// LOGZ.IO CHANGE:: exported for the DOM crosshair, which clips the line to the plot rect [unidash-perf]
export function getGridRect(chart: EChartsInstance): GridRect | undefined {
  // Reaches into the private chart model the same way enableDataZoom/getNearbySeriesData already do.
  return chart['_model']?.getComponent?.('grid')?.coordinateSystem?.getRect?.();
}
// LOGZ.IO CHANGE END:: tolerate cursor positions a couple px outside the plot rect

/*
 * Convert a point from pixel coordinate to logical coordinate.
 * Used to determine if cursor is over chart canvas and closest datapoint.
 * https://echarts.apache.org/en/api.html#echartsInstance.convertFromPixel
 */
export function getPointInGrid(cursorCoordX: number, cursorCoordY: number, chart?: EChartsInstance): number[] | null {
  if (chart === undefined) {
    return null;
  }

  let pointInPixel = [cursorCoordX, cursorCoordY];
  if (!chart.containPixel('grid', pointInPixel)) {
    // LOGZ.IO CHANGE START:: clamp near-miss cursor positions onto the plot rect
    const rect = getGridRect(chart);
    if (rect === undefined) {
      return null;
    }

    const clampedX = Math.min(Math.max(cursorCoordX, rect.x), rect.x + rect.width);
    const clampedY = Math.min(Math.max(cursorCoordY, rect.y), rect.y + rect.height);
    if (
      Math.abs(clampedX - cursorCoordX) > GRID_EDGE_TOLERANCE_PX ||
      Math.abs(clampedY - cursorCoordY) > GRID_EDGE_TOLERANCE_PX
    ) {
      return null;
    }

    pointInPixel = [clampedX, clampedY];
    // LOGZ.IO CHANGE END:: clamp near-miss cursor positions onto the plot rect
  }

  const pointInGrid: number[] = chart.convertFromPixel('grid', pointInPixel);
  return pointInGrid;
}

// LOGZ.IO CHANGE START:: skip re-dispatching an unchanged emphasis state [unidash-perf]
// Every highlight/downplay/select dispatch forces ECharts to reprocess series states and repaint,
// even when the payload is identical to the previous move (cursor traveling within one time bucket).
// Remember the last dispatched payload per chart and skip exact repeats. The cache must be cleared
// whenever the chart's option is replaced (setOption resets state), see clearNearbySeriesDispatchCache.
interface DispatchSignature {
  nearbySeriesIndexes: number[];
  emphasizedSeriesIndexes: number[];
  nonEmphasizedSeriesIndexes: number[];
  emphasizedDatapoints: DatapointInfo[];
  duplicateDatapoints: DatapointInfo[];
}

const lastDispatchSignatures = new WeakMap<EChartsInstance, DispatchSignature>();

function isSameNumbers(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isSameDatapoints(a: DatapointInfo[], b: DatapointInfo[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.seriesIndex !== b[i]?.seriesIndex || a[i]?.dataIndex !== b[i]?.dataIndex) return false;
  }
  return true;
}

function isSameDispatchSignature(previous: DispatchSignature | undefined, next: DispatchSignature): boolean {
  if (previous === undefined) return false;
  return (
    isSameNumbers(previous.nearbySeriesIndexes, next.nearbySeriesIndexes) &&
    isSameNumbers(previous.emphasizedSeriesIndexes, next.emphasizedSeriesIndexes) &&
    isSameNumbers(previous.nonEmphasizedSeriesIndexes, next.nonEmphasizedSeriesIndexes) &&
    isSameDatapoints(previous.emphasizedDatapoints, next.emphasizedDatapoints) &&
    isSameDatapoints(previous.duplicateDatapoints, next.duplicateDatapoints)
  );
}

export function clearNearbySeriesDispatchCache(chart: EChartsInstance): void {
  lastDispatchSignatures.delete(chart);
}
// LOGZ.IO CHANGE END:: skip re-dispatching an unchanged emphasis state [unidash-perf]

/*
 * TimeSeriesChart tooltip is built custom to support finding nearby series instead of single or all series.
 * This means ECharts actions need to be dispatched manually for series highlighting, datapoint select state, etc.
 * More info: https://echarts.apache.org/en/api.html#action
 */
export function batchDispatchNearbySeriesActions(
  chart: EChartsInstance,
  nearbySeriesIndexes: number[],
  emphasizedSeriesIndexes: number[],
  nonEmphasizedSeriesIndexes: number[],
  emphasizedDatapoints: DatapointInfo[],
  duplicateDatapoints: DatapointInfo[]
): void {
  // LOGZ.IO CHANGE START:: skip re-dispatching an unchanged emphasis state [unidash-perf]
  // Compared element-wise rather than through JSON.stringify: this runs on every frame of a hover and
  // the arrays grow with the series count, so serializing them was allocating on the hot path.
  const signature: DispatchSignature = {
    nearbySeriesIndexes,
    emphasizedSeriesIndexes,
    nonEmphasizedSeriesIndexes,
    emphasizedDatapoints,
    duplicateDatapoints,
  };
  if (isSameDispatchSignature(lastDispatchSignatures.get(chart), signature)) {
    return;
  }
  lastDispatchSignatures.set(chart, signature);
  // LOGZ.IO CHANGE END:: skip re-dispatching an unchanged emphasis state [unidash-perf]
  // Accounts for multiple series that are rendered direct on top of eachother.
  // Only applies select state to the datapoint that is visible to avoid color mismatch.
  const lastEmphasizedDatapoint =
    duplicateDatapoints.length > 0
      ? duplicateDatapoints[duplicateDatapoints.length - 1]
      : emphasizedDatapoints[emphasizedDatapoints.length - 1];
  if (lastEmphasizedDatapoint !== undefined) {
    // Corresponds to select options inside getTimeSeries util.
    // https://echarts.apache.org/en/option.html#series-line.select.itemStyle
    chart.dispatchAction({
      type: 'select',
      seriesIndex: lastEmphasizedDatapoint.seriesIndex,
      dataIndex: lastEmphasizedDatapoint.dataIndex,
      // Shared crosshair should not emphasize datapoints on adjacent charts.
      escapeConnect: true, // TODO: try to remove escapeConnect and match by seriesName for cross panel correlation
    });
  }

  // Blanket downplay clears axis-triggered emphasis (enlarged "big point" markers) before
  // re-applying emphasis to only the winner series.
  // https://echarts.apache.org/en/api.html#action.downplay
  chart.dispatchAction({
    type: 'downplay',
    // LOGZ.IO CHANGE
    // Without this, a downplay carrying no seriesIndex (i.e. every series) is broadcast to every
    // chart sharing this connect group, so one mouse move re-renders every panel on the dashboard.
    // The select/highlight dispatches around this one already opt out for the same reason.
    escapeConnect: true,
  });

  // Clears emphasis state of all lines that are not emphasized.
  // Emphasized is a subset of just the nearby series that are closest to cursor.
  if (nonEmphasizedSeriesIndexes.length > 0) {
    chart.dispatchAction({
      type: 'downplay',
      seriesIndex: nonEmphasizedSeriesIndexes,
      escapeConnect: true, // LOGZ.IO CHANGE:: keep de-emphasis local to the hovered chart
    });
  }

  // https://echarts.apache.org/en/api.html#action.highlight
  if (emphasizedSeriesIndexes.length > 0) {
    // Fadeout opacity of all series not closest to cursor.
    chart.dispatchAction({
      type: 'highlight',
      seriesIndex: emphasizedSeriesIndexes,
      notBlur: false, // ensure blur IS triggered, this is default but setting so it is explicit
      escapeConnect: true, // shared crosshair should not emphasize series on adjacent charts
    });
  } else {
    // When no emphasized series with bold text, notBlur allows opacity fadeout to not trigger.
    chart.dispatchAction({
      type: 'highlight',
      seriesIndex: nearbySeriesIndexes,
      notBlur: true, // do not trigger blur state when cursor is not immediately close to any series
      escapeConnect: true, // shared crosshair should not emphasize series on adjacent charts
    });

    // Clears selected datapoints since no bold series in tooltip, restore does not impact highlighting
    chart.dispatchAction({
      type: 'toggleSelect', // https://echarts.apache.org/en/api.html#action.toggleSelect
      escapeConnect: true, // LOGZ.IO CHANGE:: keep selection changes local to the hovered chart
    });
  }
}

/*
 * Determine whether a markLine was pushed into the final series, which means crosshair was already pinned onClick
 */
export function checkCrosshairPinnedStatus(seriesMapping: TimeChartSeriesMapping): boolean {
  const isCrosshairPinned = seriesMapping[seriesMapping.length - 1]?.name === PINNED_CROSSHAIR_SERIES_NAME;
  return isCrosshairPinned;
}

/*
 * Find closest timestamp to logical x coordinate returned from echartsInstance.convertFromPixel
 * Used to find nearby series in time series tooltip.
 */
// LOGZ.IO CHANGE START:: binary search over the time column [unidash-perf]
// Time series values are ordered by timestamp, so the closest row can be found in O(log n). This runs
// on every frame of a hover, twice (once for the timestamp, once for its row index), and `values` is
// a lazy tuple view whose every read materializes a tuple — so a linear walk cost one allocation per
// row per frame. Returns -1 when there is nothing to search.
export function findClosestTimestampIndex(timeSeriesValues?: TimeSeriesValueTuple[], cursorX?: number): number {
  if (timeSeriesValues === undefined || cursorX === undefined || timeSeriesValues.length === 0) {
    return -1;
  }

  let low = 0;
  let high = timeSeriesValues.length - 1;

  while (low < high) {
    const mid = (low + high) >> 1;
    const midTimestamp = timeSeriesValues[mid]?.[0];
    if (midTimestamp === undefined) break;

    if (midTimestamp < cursorX) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  // `low` is the first row at or after the cursor; its predecessor may still be nearer.
  const candidate = timeSeriesValues[low]?.[0];
  const previous = low > 0 ? timeSeriesValues[low - 1]?.[0] : undefined;

  if (candidate === undefined) return previous === undefined ? -1 : low - 1;
  if (previous === undefined) return low;

  return Math.abs(previous - cursorX) <= Math.abs(candidate - cursorX) ? low - 1 : low;
}

export function getClosestTimestamp(timeSeriesValues?: TimeSeriesValueTuple[], cursorX?: number): number | null {
  const index = findClosestTimestampIndex(timeSeriesValues, cursorX);
  return index < 0 ? null : (timeSeriesValues?.[index]?.[0] ?? null);
}
// LOGZ.IO CHANGE END:: binary search over the time column [unidash-perf]

/*
 * Find closest timestamp in full dataset, used to snap crosshair into place onClick when tooltip is pinned.
 */
export function getClosestTimestampInFullDataset(data: TimeSeries[], cursorX?: number): number | null {
  if (cursorX === undefined) {
    return null;
  }
  const totalSeries = data.length;
  let closestTimestamp = null;
  for (let seriesIdx = 0; seriesIdx < totalSeries; seriesIdx++) {
    const currentDataset = totalSeries > 0 ? data[seriesIdx] : null;
    if (!currentDataset) break;
    const currentValues: TimeSeriesValueTuple[] = currentDataset.values;
    closestTimestamp = getClosestTimestamp(currentValues, cursorX);
  }
  return closestTimestamp;
}
