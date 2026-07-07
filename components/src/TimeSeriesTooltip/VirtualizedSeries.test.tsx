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

// LOGZ.IO ADDITION:: guards the tooltip list's first paint — it must render at its real height with
// its rows already present, instead of a 10px sliver that waits for a post-mount measurement [unidash-perf]

import { TextEncoder } from 'util';
import { fireEvent, render } from '@testing-library/react';
import { NearbySeriesArray } from './types';
import { VirtualizedSeries } from './VirtualizedSeries';

// jsdom has no TextEncoder, which react-dom/server references at module scope — polyfill it before
// the explicit require below (a static import would be hoisted above the polyfill).
globalThis.TextEncoder = globalThis.TextEncoder ?? (TextEncoder as unknown as typeof globalThis.TextEncoder);
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const { renderToString } = require('react-dom/server') as typeof import('react-dom/server');

function buildSeries(count: number): NearbySeriesArray {
  const series: NearbySeriesArray = [];
  for (let i = 0; i < count; i++) {
    series.push({
      seriesIdx: i,
      datumIdx: 10,
      seriesName: `series-name-${i}`,
      date: 1671803580000,
      x: 1671821580000,
      y: count - i,
      formattedY: `${count - i}`,
      markerColor: '#56B4E9',
      isClosestToCursor: false,
      isSelected: false,
    });
  }
  return series;
}

describe('VirtualizedSeries', () => {
  it('should seed the list height from the row count so the first paint is full size', () => {
    const html = renderToString(
      <VirtualizedSeries allowActions={false} sortedFocusedSeries={buildSeries(6)} wrapLabels={false} />
    );

    expect(html).toMatch(/height:\s?132px/);
  });

  it('should cap the seeded height at the max list height for many series', () => {
    const html = renderToString(
      <VirtualizedSeries allowActions={false} sortedFocusedSeries={buildSeries(25)} wrapLabels={false} />
    );

    expect(html).toMatch(/height:\s?300px/);
  });

  it('should render the visible rows in the first paint instead of waiting for measurement', () => {
    const html = renderToString(
      <VirtualizedSeries allowActions={false} sortedFocusedSeries={buildSeries(6)} wrapLabels={false} />
    );

    for (let i = 0; i < 6; i++) {
      expect(html).toContain(`series-name-${i}`);
    }
  });

  it('should treat rows without explicit selectability metadata as selectable', () => {
    const onSelected = jest.fn();
    const series = buildSeries(2); // no metadata -> defaults to selectable

    const { getByText } = render(
      <VirtualizedSeries allowActions sortedFocusedSeries={series} wrapLabels={false} onSelected={onSelected} />
    );

    fireEvent.click(getByText('series-name-0'));

    expect(onSelected).toHaveBeenCalledWith(0);
  });

  it('should keep rows explicitly marked non-selectable unclickable', () => {
    const onSelected = jest.fn();
    const series = buildSeries(2);

    series[0] = { ...series[0]!, metadata: { isSelectable: false } };

    const { getByText } = render(
      <VirtualizedSeries allowActions sortedFocusedSeries={series} wrapLabels={false} onSelected={onSelected} />
    );

    fireEvent.click(getByText('series-name-0'));

    expect(onSelected).not.toHaveBeenCalled();
  });

  it('should not crash when the series list shrinks below the rendered row range', () => {
    // Virtuoso keeps its initially rendered range until its first measurement lands (never, in
    // jsdom); shrinking the data underneath it makes itemContent receive undefined items — the
    // panel-breaking "Cannot read properties of undefined (reading 'datumIdx')".
    const { rerender } = render(
      <VirtualizedSeries allowActions={false} sortedFocusedSeries={buildSeries(14)} wrapLabels={false} />
    );

    expect(() =>
      rerender(<VirtualizedSeries allowActions={false} sortedFocusedSeries={buildSeries(3)} wrapLabels={false} />)
    ).not.toThrow();
  });
});
