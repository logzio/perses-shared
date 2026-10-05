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

// LOGZ.IO CHANGE START:: Panel-level "Instant query"
import { resolveActivePanelQueryMode, resolvePanelQueryMode, supportsPanelQueryMode } from './query-mode';

describe('resolvePanelQueryMode', () => {
  it.each([
    ['instant', 'instant'],
    ['range', 'range'],
  ])('should accept %s', (input, expected) => {
    expect(resolvePanelQueryMode(input)).toBe(expected);
  });

  it.each([
    ['an unknown word', 'both'],
    ['a different case', 'Instant'],
    ['a number', 1],
    ['a boolean', true],
    ['null', null],
    ['nothing', undefined],
  ])('should read %s as unset, so the panel plugin decides', (_label, input) => {
    expect(resolvePanelQueryMode(input)).toBeUndefined();
  });
});

describe('resolveActivePanelQueryMode', () => {
  it('should apply a valid mode on a kind that supports it', () => {
    expect(resolveActivePanelQueryMode({ panelKind: 'BarChart', queryMode: 'instant' })).toBe('instant');
  });

  it('should ignore a mode left behind when the visualization changed to a kind that does not support it', () => {
    expect(resolveActivePanelQueryMode({ panelKind: 'TimeSeriesChart', queryMode: 'instant' })).toBeUndefined();
  });

  it('should ignore a value that is not one of the two modes', () => {
    expect(resolveActivePanelQueryMode({ panelKind: 'BarChart', queryMode: 'Instant' })).toBeUndefined();
  });
});

describe('supportsPanelQueryMode', () => {
  it('should offer the setting on a bar chart', () => {
    expect(supportsPanelQueryMode('BarChart')).toBe(true);
  });

  it.each(['TimeSeriesChart', 'Table', 'StatChart', 'PieChart'])('should not offer it on a %s yet', (kind) => {
    expect(supportsPanelQueryMode(kind)).toBe(false);
  });
});
// LOGZ.IO CHANGE END:: Panel-level "Instant query"
