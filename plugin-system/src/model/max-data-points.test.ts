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

// LOGZ.IO CHANGE START:: Panel-level "Max data points" [APPZ-3369]
import { MAX_MAX_DATA_POINTS, parseMaxDataPointsInput, resolveMaxDataPoints } from './max-data-points';

describe('resolveMaxDataPoints', () => {
  it.each([
    ['a value in range', 250, 250],
    ['the lowest accepted value', 1, 1],
    ['the highest accepted value', MAX_MAX_DATA_POINTS, MAX_MAX_DATA_POINTS],
    ['a value above the range', 50_000, MAX_MAX_DATA_POINTS],
    ['a fraction', 99.7, 99],
    ['zero', 0, undefined],
    ['a negative value', -5, undefined],
    ['a fraction below one', 0.4, undefined],
    ['not a number', NaN, undefined],
    ['infinity', Infinity, undefined],
    ['a numeric string', '300', undefined],
    ['nothing', undefined, undefined],
  ])('should resolve %s to %p', (_, input, expected) => {
    expect(resolveMaxDataPoints(input)).toBe(expected);
  });
});

describe('parseMaxDataPointsInput', () => {
  it.each([
    ['a typed number', '300', 300],
    ['surrounding whitespace', '  42  ', 42],
    ['an empty field', '', undefined],
    ['a field of spaces', '   ', undefined],
    ['text', 'abc', undefined],
    ['zero', '0', undefined],
    ['a value above the range', '5000', MAX_MAX_DATA_POINTS],
  ])('should parse %s to %p', (_, input, expected) => {
    expect(parseMaxDataPointsInput(input)).toBe(expected);
  });
});
// LOGZ.IO CHANGE END:: Panel-level "Max data points" [APPZ-3369]
