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

import { EChartsDataFormat, FormatOptions } from '../model';
// LOGZ.IO CHANGE:: pickClosestSeries (+ NearbySeriesArray) imported for the Single-mode tests below
import { legacyCheckforNearbySeries, getYBuffer, isWithinPercentageRange, pickClosestSeries } from './nearby-series';
import { NearbySeriesArray } from './types';

describe('legacyCheckforNearbySeries', () => {
  const chartData: EChartsDataFormat = {
    timeSeries: [
      {
        type: 'line',
        name: 'env="demo", instance="demo.do.prometheus", job="node", mode="test"',
        color: 'hsla(-1365438424,50%,50%,0.8)',
        data: [
          0.0002315202231525094, 0.00022873082287300112, 0.00023152022315149463, 0.00023152022315149463,
          0.00022873082287300112,
        ],
        symbol: 'circle',
      },
      {
        type: 'line',
        name: 'env="demo", instance="demo.do.prometheus", job="node", mode="test alt"',
        color: 'hsla(286664040,50%,50%,0.8)',
        data: [0.05245188284519867, 0.0524463040446356, 0.0524463040446356, 0.05247140864723438, 0.052482566248230646],
        symbol: 'circle',
      },
    ],
    xAxis: [1654007865000, 1654007880000, 1654007895000, 1654007910000, 1654007925000],
    rangeMs: 60000,
  };

  // https://echarts.apache.org/en/api.html#echartsInstance.convertFromPixel
  const pointInGrid = [2, 0.0560655737704918]; // converted from chart.getZr() mousemove coordinates

  const yBuffer = 0.02; // calculated from y axis interval

  const nearbySeriesOutput = [
    {
      date: 1654007895000,
      datumIdx: 2,
      isClosestToCursor: true,
      markerColor: 'hsla(286664040,50%,50%,0.8)',
      seriesName: 'env="demo", instance="demo.do.prometheus", job="node", mode="test alt"',
      seriesIdx: 1,
      x: 1654007895000,
      y: 0.0524463040446356,
      formattedY: '0.05',
      isSelected: false, // LOGZ.IO CHANGE:: Drilldown panel [APPZ-377]
    },
  ];

  it('should return nearby series data for points nearby the cursor', () => {
    const decimalUnit: FormatOptions = {
      unit: 'decimal',
      decimalPlaces: 2,
    };
    expect(legacyCheckforNearbySeries(chartData, pointInGrid, yBuffer, undefined, decimalUnit)).toEqual(
      nearbySeriesOutput
    );
  });

  it('should return series values formatted as a percent', () => {
    const percentFormattedOutput = [...nearbySeriesOutput];
    if (percentFormattedOutput[0]) {
      percentFormattedOutput[0].formattedY = '5%';
    }
    const percentFormattedUnit: FormatOptions = {
      unit: 'percent-decimal',
      decimalPlaces: 0,
    };
    expect(legacyCheckforNearbySeries(chartData, pointInGrid, yBuffer, undefined, percentFormattedUnit)).toEqual(
      percentFormattedOutput
    );
  });
});

describe('getYBuffer', () => {
  it('should return area to search for nearby series', () => {
    expect(getYBuffer({ yInterval: 1, totalSeries: 10, showAllSeries: false })).toBe(1);
  });

  it('should return entire canvas', () => {
    expect(getYBuffer({ yInterval: 1, totalSeries: 10, showAllSeries: true })).toBe(10);
  });

  it('should reduce area to search when many series', () => {
    expect(getYBuffer({ yInterval: 1, totalSeries: 1000, showAllSeries: false })).toBe(0.3);
  });

  it('should return area to search for larger interval', () => {
    // LOGZ.IO CHANGE:: Tooltip is not behaving correctly [APPZ-1418]
    expect(getYBuffer({ yInterval: 10, totalSeries: 10, showAllSeries: false })).toBe(10);
  });

  it('should return entire canvas for larger interval', () => {
    expect(getYBuffer({ yInterval: 10, totalSeries: 10, showAllSeries: true })).toBe(100);
  });

  it('should reduce area to search for larger interval when many series', () => {
    expect(getYBuffer({ yInterval: 10, totalSeries: 1000, showAllSeries: false })).toBe(3);
  });
});

describe('isWithinPercentageRange', () => {
  it('should return true when input value is within the specified percentage range of yValue', () => {
    const yValue = 261353472;
    const result = isWithinPercentageRange({ valueToCheck: 256250000, baseValue: yValue, percentage: 5 });
    expect(result).toBe(true);
  });

  it('returns false when nearbyY is outside the specified percentage range of yValue', () => {
    const yValue = 100;
    const result = isWithinPercentageRange({ valueToCheck: 200, baseValue: yValue, percentage: 5 });
    expect(result).toBe(false);
  });
});

// LOGZ.IO CHANGE START:: Single tooltip mode — pickClosestSeries reduces nearby series to the closest one
describe('pickClosestSeries', () => {
  const makeSeries = (seriesIdx: number, y: number, isClosestToCursor = false): NearbySeriesArray[number] => ({
    seriesIdx,
    datumIdx: 0,
    seriesName: `series-${seriesIdx}`,
    date: 0,
    markerColor: '#000',
    x: 0,
    y,
    formattedY: `${y}`,
    isClosestToCursor,
    isSelected: false,
  });

  it('should keep only the series whose value is nearest the cursor Y when none is flagged', () => {
    const result = pickClosestSeries([makeSeries(0, 10), makeSeries(1, 50), makeSeries(2, 12)], 11);
    expect(result).toHaveLength(1);
    expect(result[0]?.seriesIdx).toBe(0);
  });

  it('should prefer the series flagged isClosestToCursor even if another is numerically closer', () => {
    // series 0 has the smaller raw distance to cursorY=10, but series 1 is the pipeline's flagged winner
    const result = pickClosestSeries([makeSeries(0, 10, false), makeSeries(1, 11, true)], 10);
    expect(result).toHaveLength(1);
    expect(result[0]?.seriesIdx).toBe(1);
    expect(result[0]?.isClosestToCursor).toBe(true);
  });

  it('should return the input unchanged when it has one or zero entries', () => {
    expect(pickClosestSeries([], 5)).toHaveLength(0);
    const single = [makeSeries(0, 3)];
    expect(pickClosestSeries(single, 100)).toBe(single);
  });
});
// LOGZ.IO CHANGE END:: Single tooltip mode — pickClosestSeries reduces nearby series to the closest one
