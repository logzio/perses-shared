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

import { getFormattedAxis, getFormattedMultipleYAxes } from './axis';

interface AxisLabelShape {
  showMinLabel?: boolean;
  showMaxLabel?: boolean;
  hideOverlap?: boolean;
}
interface AxisShape {
  boundaryGap?: unknown;
  axisLabel?: AxisLabelShape;
}

describe('getFormattedAxis', () => {
  it('should always render the extreme (min/max) labels and thin only overlapping middle ticks', () => {
    const [axis] = getFormattedAxis({}, { unit: 'percent', decimalPlaces: 0 }) as AxisShape[];

    expect(axis?.axisLabel?.showMinLabel).toBe(true);
    expect(axis?.axisLabel?.showMaxLabel).toBe(true);
    expect(axis?.axisLabel?.hideOverlap).toBe(true);
  });

  it('should not apply the fixed 10% top padding so ECharts can round the axis max to a nice number', () => {
    const [axis] = getFormattedAxis({}, { unit: 'percent', decimalPlaces: 0 }) as AxisShape[];

    expect(axis?.boundaryGap).toBeUndefined();
  });

  it('should preserve caller-supplied axis options when merging', () => {
    const [axis] = getFormattedAxis({ splitNumber: 4 } as never, { unit: 'decimal' }) as Array<
      AxisShape & { splitNumber?: number }
    >;

    expect(axis?.splitNumber).toBe(4);
    expect(axis?.axisLabel?.showMaxLabel).toBe(true);
  });
});

describe('getFormattedMultipleYAxes', () => {
  it('should force extreme labels and drop the fixed padding on the base (left) axis', () => {
    const [baseAxis] = getFormattedMultipleYAxes(undefined, { unit: 'percent' }, []) as unknown as AxisShape[];

    expect(baseAxis?.axisLabel?.showMinLabel).toBe(true);
    expect(baseAxis?.axisLabel?.showMaxLabel).toBe(true);
    expect(baseAxis?.axisLabel?.hideOverlap).toBe(true);
    expect(baseAxis?.boundaryGap).toBeUndefined();
  });

  it('should force extreme labels and drop the fixed padding on additional (right) axes', () => {
    const axes = getFormattedMultipleYAxes(undefined, { unit: 'percent' }, [
      { unit: 'decimal' },
    ]) as unknown as AxisShape[];
    const rightAxis = axes[1];

    expect(rightAxis?.axisLabel?.showMinLabel).toBe(true);
    expect(rightAxis?.axisLabel?.showMaxLabel).toBe(true);
    expect(rightAxis?.axisLabel?.hideOverlap).toBe(true);
    expect(rightAxis?.boundaryGap).toBeUndefined();
  });
});
