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
import { TimeSeriesMetadata } from '@perses-dev/core';
import type { CursorCoordinates } from './tooltip-model'; // LOGZ.IO CHANGE:: Drilldown panel

export interface NearbySeriesInfo {
  seriesIdx: number | null;
  datumIdx: number | null;
  seriesName: string;
  date: number;
  markerColor: string;
  x: number;
  y: number;
  formattedY: string;
  isClosestToCursor: boolean;
  isSelected: boolean;
  metadata?: TimeSeriesMetadata;
}

export type NearbySeriesArray = NearbySeriesInfo[];

// LOGZ.IO CHANGE START:: Drilldown panel [unidash-perf]
/** The drilldown series a pinned tooltip keeps, and the pin it was made on. `null` means none. */
export interface PinnedSeriesSelection {
  pinnedPos: CursorCoordinates;
  seriesIdx: number | null;
}
// LOGZ.IO CHANGE END:: Drilldown panel [unidash-perf]

// LOGZ.IO CHANGE:: Drilldown panel — selection is the tooltip's to mark, see markSelectedSeries [unidash-perf]
export type Candidate = Omit<NearbySeriesInfo, 'isClosestToCursor' | 'isSelected' | 'seriesIdx' | 'datumIdx'> & {
  seriesIdx: number;
  datumIdx: number;
  visualY: number;
  distance: number;
  id: string;
};

export type CalculateVisualYForSeriesParams = {
  rawY: number;
  stackId?: string;
  stackTotals: Map<string, number>;
};

export type CalculateBarBandwidthParams = {
  timestampCenterX: number;
  prevTimestamp: number | undefined;
  nextTimestamp: number | undefined;
  chart: EChartsInstance;
  defaultBandwidth?: number;
};

export type CalculateBarSegmentBoundsParams = {
  timestampCenterX: number;
  bandwidth: number;
  seriesIdx: number;
  barSeriesOrder: number[];
  isStacked: boolean;
};

export type BarSegmentBounds = {
  segLeft: number;
  segRight: number;
};

export type CalculateBarYBoundsParams = {
  visualY: number;
  rawY: number;
  isStacked: boolean;
};

export type BarYBounds = {
  base: number;
  lower: number;
  upper: number;
};

/**
 * Parameters for isWithinPercentageRange function
 */
export type IsWithinPercentageRangeParams = {
  valueToCheck: number;
  baseValue: number;
  percentage: number;
};

/**
 * Parameters for getYBuffer function
 */
export type GetYBufferParams = {
  yInterval: number;
  totalSeries: number;
  showAllSeries?: boolean;
};
