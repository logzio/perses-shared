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

// LOGZ.IO CHANGE START:: Item-level (single panel) repeat, mirroring Grafana's panel repeat [APPZ-0000]

import { VariableStateMap } from '@perses-dev/plugin-system';
import { PanelGroupItemLayout } from '../../model';
import { expandRepeatedItemLayouts, isRepeatInstanceId } from './repeat-item-layouts';

const item = (overrides: Partial<PanelGroupItemLayout> & { i: string }): PanelGroupItemLayout => ({
  x: 0,
  y: 0,
  w: 12,
  h: 8,
  ...overrides,
});

const variables = (state: Record<string, VariableStateMap[string]>): VariableStateMap => state;

const hosts = (...values: string[]): VariableStateMap => variables({ host: { value: values, loading: false } });

const geometry = (layouts: ReturnType<typeof expandRepeatedItemLayouts>['layouts']): Array<Record<string, unknown>> =>
  layouts.map(({ x, y, w, h, binding }) => ({ x, y, w, h, value: binding?.[1] }));

describe('expandRepeatedItemLayouts', () => {
  test('should pass items through untouched when nothing repeats', () => {
    const layouts = [item({ i: 'a' }), item({ i: 'b', x: 12 })];

    const result = expandRepeatedItemLayouts(layouts, {});

    expect(result.hasRepeats).toBe(false);
    expect(geometry(result.layouts)).toEqual([
      { x: 0, y: 0, w: 12, h: 8, value: undefined },
      { x: 12, y: 0, w: 12, h: 8, value: undefined },
    ]);
  });

  test('should pack horizontal repeats across the full grid width by default', () => {
    const result = expandRepeatedItemLayouts([item({ i: 'a', repeatVariable: 'host' })], hosts('a', 'b', 'c'));

    expect(result.hasRepeats).toBe(true);
    expect(geometry(result.layouts)).toEqual([
      { x: 0, y: 0, w: 8, h: 8, value: 'a' },
      { x: 8, y: 0, w: 8, h: 8, value: 'b' },
      { x: 16, y: 0, w: 8, h: 8, value: 'c' },
    ]);
  });

  test('should divide the row among the instances when they fit within maxPerRow', () => {
    const result = expandRepeatedItemLayouts([item({ i: 'a', repeatVariable: 'host' })], hosts('a', 'b'));

    // maxPerRow is a floor on width, not a forced division: two values share the row at half each.
    expect(geometry(result.layouts)).toEqual([
      { x: 0, y: 0, w: 12, h: 8, value: 'a' },
      { x: 12, y: 0, w: 12, h: 8, value: 'b' },
    ]);
  });

  test('should clamp instance width at 1/maxPerRow once there are more values than fit', () => {
    const result = expandRepeatedItemLayouts(
      [item({ i: 'a', repeatVariable: 'host', maxPerRow: 4 })],
      hosts('a', 'b', 'c', 'd', 'e', 'f')
    );

    expect(result.layouts.every((layout) => layout.w === 6)).toBe(true);
    expect(geometry(result.layouts).slice(3)).toEqual([
      { x: 18, y: 0, w: 6, h: 8, value: 'd' },
      { x: 0, y: 8, w: 6, h: 8, value: 'e' },
      { x: 6, y: 8, w: 6, h: 8, value: 'f' },
    ]);
  });

  test('should wrap horizontal repeats onto a new line past maxPerRow', () => {
    const result = expandRepeatedItemLayouts(
      [item({ i: 'a', repeatVariable: 'host', maxPerRow: 2 })],
      hosts('a', 'b', 'c')
    );

    expect(geometry(result.layouts)).toEqual([
      { x: 0, y: 0, w: 12, h: 8, value: 'a' },
      { x: 12, y: 0, w: 12, h: 8, value: 'b' },
      { x: 0, y: 8, w: 12, h: 8, value: 'c' },
    ]);
  });

  test('should stack vertical repeats keeping the authored width and x', () => {
    const result = expandRepeatedItemLayouts(
      [item({ i: 'a', x: 6, w: 6, repeatVariable: 'host', repeatDirection: 'v' })],
      hosts('a', 'b')
    );

    expect(geometry(result.layouts)).toEqual([
      { x: 6, y: 0, w: 6, h: 8, value: 'a' },
      { x: 6, y: 8, w: 6, h: 8, value: 'b' },
    ]);
  });

  test('should push items below a repeat down by exactly the height it added', () => {
    const layouts = [item({ i: 'a', repeatVariable: 'host', repeatDirection: 'v' }), item({ i: 'b', y: 8 })];

    const result = expandRepeatedItemLayouts(layouts, hosts('a', 'b', 'c'));

    // Three stacked instances occupy y 0..24, so the follower moves from 8 to 24.
    expect(result.layouts.find((layout) => layout.i === 'b')?.y).toBe(24);
    expect(result.yOffsets['b']).toBe(16);
  });

  test('should not push items down when a single horizontal line was enough', () => {
    const layouts = [item({ i: 'a', repeatVariable: 'host' }), item({ i: 'b', y: 8 })];

    const result = expandRepeatedItemLayouts(layouts, hosts('a', 'b', 'c', 'd'));

    expect(result.layouts.find((layout) => layout.i === 'b')?.y).toBe(8);
    expect(result.yOffsets['b']).toBe(0);
  });

  test('should leave a neighbour beside a vertical repeat on its own grid row', () => {
    const layouts = [
      item({ i: 'a', w: 12, repeatVariable: 'host', repeatDirection: 'v' }),
      item({ i: 'beside', x: 12, w: 12 }),
      item({ i: 'below', y: 8 }),
    ];

    const result = expandRepeatedItemLayouts(layouts, hosts('a', 'b'));

    expect(result.layouts.find((layout) => layout.i === 'beside')?.y).toBe(0);
    expect(result.layouts.find((layout) => layout.i === 'below')?.y).toBe(16);
  });

  test('should shift a neighbour beside a horizontal repeat, which claims the whole row', () => {
    const layouts = [
      item({ i: 'a', w: 12, repeatVariable: 'host', maxPerRow: 1 }),
      item({ i: 'beside', x: 12, w: 12 }),
    ];

    const result = expandRepeatedItemLayouts(layouts, hosts('a', 'b'));

    expect(result.layouts.find((layout) => layout.i === 'beside')?.y).toBe(8);
  });

  test('should accumulate offsets across several repeats', () => {
    const layouts = [
      item({ i: 'a', repeatVariable: 'host', repeatDirection: 'v' }),
      item({ i: 'b', y: 8, repeatVariable: 'host', repeatDirection: 'v' }),
      item({ i: 'c', y: 16 }),
    ];

    const result = expandRepeatedItemLayouts(layouts, hosts('a', 'b'));

    expect(result.layouts.find((layout) => layout.i === 'c')?.y).toBe(32);
  });

  test('should render one instance for a single-value variable', () => {
    const result = expandRepeatedItemLayouts([item({ i: 'a', repeatVariable: 'host' })], hosts('only'));

    // Grafana widens a horizontal repeat to fill the row even for one value.
    expect(geometry(result.layouts)).toEqual([{ x: 0, y: 0, w: 24, h: 8, value: 'only' }]);
  });

  test('should repeat over a scalar variable value', () => {
    const result = expandRepeatedItemLayouts(
      [item({ i: 'a', repeatVariable: 'host', repeatDirection: 'v' })],
      variables({ host: { value: 'single', loading: false } })
    );

    expect(result.layouts).toHaveLength(1);
    expect(result.layouts[0]?.binding).toEqual(['host', 'single']);
  });

  test.each([
    ['unknown', {}],
    ['loading', variables({ host: { value: ['a', 'b'], loading: true } })],
    ['null-valued', variables({ host: { value: null, loading: false } })],
    ['empty', variables({ host: { value: [], loading: false } })],
  ])('should render the item as authored when the variable is %s', (_label, state) => {
    const result = expandRepeatedItemLayouts([item({ i: 'a', w: 6, repeatVariable: 'host' })], state);

    expect(result.hasRepeats).toBe(false);
    expect(geometry(result.layouts)).toEqual([{ x: 0, y: 0, w: 6, h: 8, value: undefined }]);
  });

  test('should give every instance a distinct id that traces back to the authored item', () => {
    const result = expandRepeatedItemLayouts([item({ i: 'a', repeatVariable: 'host' })], hosts('x', 'y'));

    const ids = result.layouts.map((layout) => layout.i);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every(isRepeatInstanceId)).toBe(true);
    expect(result.layouts.every((layout) => layout.sourceLayoutId === 'a')).toBe(true);
  });

  test('should not mark an authored id as a repeat instance', () => {
    const result = expandRepeatedItemLayouts([item({ i: 'a' })], {});

    expect(isRepeatInstanceId(result.layouts[0]?.i ?? '')).toBe(false);
  });

  test('should order output top-to-bottom then left-to-right regardless of input order', () => {
    const layouts = [item({ i: 'c', y: 8 }), item({ i: 'b', x: 12 }), item({ i: 'a' })];

    const result = expandRepeatedItemLayouts(layouts, {});

    expect(result.layouts.map((layout) => layout.i)).toEqual(['a', 'b', 'c']);
  });
});

// LOGZ.IO CHANGE END:: Item-level (single panel) repeat [APPZ-0000]
