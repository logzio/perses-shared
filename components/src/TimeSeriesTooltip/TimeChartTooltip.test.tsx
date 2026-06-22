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

// LOGZ.IO ADDITION:: Tests for persisted "show all" tooltip mode seeding

import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { TimeSeries } from '@perses-dev/spec';
import { TimeChartTooltip } from './TimeChartTooltip';
import { getNearbySeriesData } from './nearby-series';
import { useMousePosition } from './tooltip-model';
import { NearbySeriesArray } from './types';

jest.mock('./nearby-series');
jest.mock('./tooltip-model', () => ({
  ...jest.requireActual('./tooltip-model'),
  useMousePosition: jest.fn(),
}));

describe('TimeChartTooltip', () => {
  const testSeriesTimeMs = 1671803580000;
  const testNearbySeries: NearbySeriesArray = [
    {
      seriesIdx: 0,
      datumIdx: 14,
      seriesName: '{instance="demo:9100",job="node"}',
      date: testSeriesTimeMs,
      x: testSeriesTimeMs,
      y: 0.29,
      formattedY: '29%',
      markerColor: '#56B4E9',
      isClosestToCursor: true,
      isSelected: false,
    },
  ];

  // 6 entries so the "Show All" toggle always renders (existing gate: totalSeries > 5),
  // letting us assert the seeded *checked* state independently of the gate relaxation (Task 2).
  const sixSeries = Array.from({ length: 6 }, (_, i) => ({ name: `s${i}`, values: [] })) as TimeSeries[];

  const renderTooltip = (defaultSeriesMode: 'single' | 'nearby' | 'all'): void => {
    const canvas = document.createElement('canvas');
    (useMousePosition as jest.Mock).mockReturnValue({
      page: { x: 100, y: 100 },
      client: { x: 100, y: 100 },
      plotCanvas: { x: 50, y: 50 },
      target: canvas,
    });
    (getNearbySeriesData as jest.Mock).mockReturnValue(testNearbySeries);

    render(
      <TimeChartTooltip
        chartRef={{ current: undefined }}
        data={sixSeries}
        seriesMapping={[]}
        enablePinning
        pinnedPos={null}
        defaultSeriesMode={defaultSeriesMode}
      />
    );
  };

  it('should seed the show all toggle on when the panel mode is all', () => {
    renderTooltip('all');
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('should seed the show all toggle off when the panel mode is nearby', () => {
    renderTooltip('nearby');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});
