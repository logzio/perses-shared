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

import { VariableDefinition } from '@perses-dev/spec';
import { VariableState, VariableStoreStateMap } from '@perses-dev/plugin-system';
import { ExternalVariableDefinition } from '../../model/VariableDefinition';
import {
  areVariableOptionsEqual,
  areVariableStateMapsEqual,
  checkSavedDefaultVariableStatus,
  mergeVariableDefinitions,
} from './utils';

describe('checkSavedDefaultVariableStatus', () => {
  it('should check whether saved variable definitions are out of date with current default values state', () => {
    const savedVariables: VariableDefinition[] = [
      {
        kind: 'ListVariable',
        spec: {
          name: 'interval',
          defaultValue: '1m',
          allowAllValue: false,
          allowMultiple: false,
          plugin: {
            kind: 'StaticListVariable',
            spec: {
              values: ['1m', '5m'],
            },
          },
        },
      },
      {
        kind: 'ListVariable',
        spec: {
          name: 'NewListVariable',
          display: {
            name: 'Test display label',
            hidden: false,
          },
          defaultValue: 'second list value',
          allowAllValue: true,
          allowMultiple: false,
          plugin: {
            kind: 'StaticListVariable',
            spec: {
              values: [
                {
                  label: 'test list value',
                  value: 'test list value',
                },
                {
                  label: 'second list value',
                  value: 'second list value',
                },
                {
                  label: 'another list value',
                  value: 'another list value',
                },
              ],
            },
          },
        },
      },
      {
        kind: 'TextVariable',
        spec: {
          name: 'NewTextVariable',
          display: {
            name: 'Text display',
            hidden: false,
          },
          constant: true,
          value: 'first text value',
        },
      },
    ];
    const variableState = new VariableStoreStateMap();
    variableState.set(
      { name: 'interval' },
      {
        value: '5m',
        loading: false,
        options: [
          {
            label: '1m',
            value: '1m',
          },
          {
            label: '5m',
            value: '5m',
          },
        ],
      }
    );
    variableState.set(
      { name: 'NewListVariable' },
      {
        value: 'last list value',
        loading: false,
        options: [
          {
            label: 'test list value',
            value: 'test list value',
          },
          {
            label: 'second list value',
            value: 'second list value',
          },
          {
            label: 'last list value',
            value: 'last list value',
          },
        ],
        defaultValue: 'test list value',
      }
    );
    variableState.set(
      { name: 'NewTextVariable' },
      {
        value: 'New text value',
        loading: false,
      }
    );
    const { isSavedVariableModified } = checkSavedDefaultVariableStatus(savedVariables, variableState);
    expect(isSavedVariableModified).toBe(true);
  });

  it('should confirm list variable default value was not modified', () => {
    const savedVariables: VariableDefinition[] = [
      {
        kind: 'ListVariable',
        spec: {
          name: 'interval',
          defaultValue: '5m',
          allowAllValue: false,
          allowMultiple: false,
          plugin: {
            kind: 'StaticListVariable',
            spec: {
              values: ['1m', '5m'],
            },
          },
        },
      },
    ];
    const variableState = new VariableStoreStateMap();
    variableState.set(
      { name: 'interval' },
      {
        value: '5m',
        defaultValue: '5m',
        loading: false,
        options: [
          {
            label: '1m',
            value: '1m',
          },
          {
            label: '5m',
            value: '5m',
          },
        ],
      }
    );
    const { isSavedVariableModified } = checkSavedDefaultVariableStatus(savedVariables, variableState);
    expect(isSavedVariableModified).toBe(false);
  });

  it('should confirm null list variable was not modified', () => {
    const savedVariables: VariableDefinition[] = [
      {
        kind: 'ListVariable',
        spec: {
          allowAllValue: false,
          allowMultiple: false,
          plugin: {
            kind: 'StaticListVariable',
            spec: {
              values: [],
            },
          },
          name: 'EmptyListVariableTest',
        },
      },
    ];
    const variableState = new VariableStoreStateMap();
    variableState.set(
      { name: 'EmptyListVariableTest' },
      {
        value: null,
        loading: false,
        options: [],
      }
    );
    const { isSavedVariableModified } = checkSavedDefaultVariableStatus(savedVariables, variableState);
    expect(isSavedVariableModified).toBe(false);
  });

  it('should confirm text variable value was not modified', () => {
    const savedVariables: VariableDefinition[] = [
      {
        kind: 'TextVariable',
        spec: {
          name: 'NewTextVariable',
          display: {
            name: 'Text display',
            hidden: false,
          },
          constant: true,
          value: 'first text value',
        },
      },
    ];
    const variableState = new VariableStoreStateMap();
    variableState.set(
      { name: 'NewTextVariable' },
      {
        value: 'first text value',
        loading: false,
      }
    );
    const { isSavedVariableModified } = checkSavedDefaultVariableStatus(savedVariables, variableState);
    expect(isSavedVariableModified).toBe(false);
  });

  it('should confirm text variable value was modified', () => {
    const savedVariables: VariableDefinition[] = [
      {
        kind: 'TextVariable',
        spec: {
          name: 'NewTextVariable',
          value: 'Lorem ipsum',
        },
      },
    ];
    const variableState = new VariableStoreStateMap();
    variableState.set(
      { name: 'NewTextVariable' },
      {
        value: 'updated text value',
        loading: false,
      }
    );
    const { isSavedVariableModified } = checkSavedDefaultVariableStatus(savedVariables, variableState);
    expect(isSavedVariableModified).toBe(true);
  });

  it('should merge variable definitions giving priority on local over externals', () => {
    const localVariables: VariableDefinition[] = [
      {
        kind: 'TextVariable',
        spec: {
          name: 'NewTextVariable',
          value: 'Lorem ipsum',
        },
      },
    ];
    const externalVariables: ExternalVariableDefinition[] = [
      {
        source: 'project',
        definitions: [
          {
            kind: 'TextVariable',
            spec: {
              name: 'project_greetings',
              display: {
                name: 'Greetings(project)',
              },
              constant: false,
              value: 'hello',
            },
          },
          {
            kind: 'TextVariable',
            spec: {
              name: 'overridden',
              value: 'project scope value',
            },
          },
        ],
      },
      {
        source: 'global',
        definitions: [
          {
            kind: 'TextVariable',
            spec: {
              name: 'global_greetings',
              display: {
                name: 'Greetings(global)',
              },
              constant: true,
              value: 'hello',
            },
          },
          {
            kind: 'TextVariable',
            spec: {
              name: 'overridden',
              value: 'global scope value',
            },
          },
        ],
      },
    ];

    const expected = [
      {
        kind: 'TextVariable',
        spec: {
          name: 'NewTextVariable',
          value: 'Lorem ipsum',
        },
      },
      {
        kind: 'TextVariable',
        spec: {
          name: 'project_greetings',
          display: {
            name: 'Greetings(project)',
          },
          constant: false,
          value: 'hello',
        },
      },
      {
        kind: 'TextVariable',
        spec: {
          name: 'overridden',
          value: 'project scope value',
        },
      },
      {
        kind: 'TextVariable',
        spec: {
          name: 'global_greetings',
          display: {
            name: 'Greetings(global)',
          },
          constant: true,
          value: 'hello',
        },
      },
    ];
    expect(mergeVariableDefinitions(localVariables, externalVariables)).toEqual(expected);
  });
});

// LOGZ.IO ADDITION START:: [unidash-perf]
// Every panel on the dashboard subscribes to the variable state, so these two comparisons decide how
// often a refresh of a variable's options re-renders the whole dashboard.

describe('areVariableOptionsEqual', () => {
  const options = [
    { value: 'test_value_1', label: 'Test label 1' },
    { value: 'test_value_2', label: 'Test label 2' },
  ];

  it('should treat a refetched list with the same contents as equal', () => {
    expect(areVariableOptionsEqual(options, [...options.map((option) => ({ ...option }))])).toBe(true);
  });

  it('should treat the same list instance as equal', () => {
    expect(areVariableOptionsEqual(options, options)).toBe(true);
  });

  it('should treat a changed label as different', () => {
    expect(areVariableOptionsEqual(options, [options[0]!, { value: 'test_value_2', label: 'Test label 3' }])).toBe(
      false
    );
  });

  it('should treat a changed value as different', () => {
    expect(areVariableOptionsEqual(options, [options[0]!, { value: 'test_value_3', label: 'Test label 2' }])).toBe(
      false
    );
  });

  it('should treat a different length as different', () => {
    expect(areVariableOptionsEqual(options, [options[0]!])).toBe(false);
  });

  it('should treat a missing list as different from a populated one', () => {
    expect(areVariableOptionsEqual(undefined, options)).toBe(false);
    expect(areVariableOptionsEqual(options, undefined)).toBe(false);
    expect(areVariableOptionsEqual(undefined, undefined)).toBe(true);
  });
});

describe('areVariableStateMapsEqual', () => {
  const options = [{ value: 'test_value_1', label: 'Test label 1' }];
  const state = (overrides: Partial<VariableState> = {}): VariableState => ({
    value: 'test_value_1',
    loading: false,
    options,
    ...overrides,
  });

  it('should treat two maps holding equal states as equal', () => {
    expect(areVariableStateMapsEqual({ cluster: state() }, { cluster: state() })).toBe(true);
  });

  it('should treat a changed loading flag as different', () => {
    expect(areVariableStateMapsEqual({ cluster: state() }, { cluster: state({ loading: true }) })).toBe(false);
  });

  it('should treat a changed value as different', () => {
    expect(areVariableStateMapsEqual({ cluster: state() }, { cluster: state({ value: 'test_value_2' }) })).toBe(false);
  });

  it('should compare multi-select values element by element', () => {
    const left = { cluster: state({ value: ['test_value_1', 'test_value_2'] }) };
    expect(areVariableStateMapsEqual(left, { cluster: state({ value: ['test_value_1', 'test_value_2'] }) })).toBe(true);
    expect(areVariableStateMapsEqual(left, { cluster: state({ value: ['test_value_2', 'test_value_1'] }) })).toBe(
      false
    );
  });

  it('should treat a replaced options list as different', () => {
    expect(areVariableStateMapsEqual({ cluster: state() }, { cluster: state({ options: [...options] }) })).toBe(false);
  });

  it('should treat a different set of variables as different', () => {
    expect(areVariableStateMapsEqual({ cluster: state() }, { cluster: state(), region: state() })).toBe(false);
    expect(areVariableStateMapsEqual({ cluster: state() }, { region: state() })).toBe(false);
  });
});
// LOGZ.IO ADDITION END:: [unidash-perf]
