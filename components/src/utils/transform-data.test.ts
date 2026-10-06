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

import { Transform } from '../model';
import { transformData } from './transform-data';

function generateMockFlattenQueriesResult(): Array<Record<string, unknown>> {
  return [
    // QUERY #1
    {
      ['timestamp #1']: 1630000000,
      ['value #1']: 55,
      ['job #1']: 'job1',
      ['instance #1']: 'instance1',
    },
    {
      ['timestamp #1']: 1630000000,
      ['value #1']: 33,
      ['job #1']: 'job1',
      ['instance #1']: 'instance2',
    },
    {
      ['timestamp #1']: 1630000000,
      ['value #1']: 45,
      ['job #1']: 'job1',
      ['instance #1']: 'instance3',
    },
    // QUERY #2
    {
      ['timestamp #2']: 1630000000,
      ['value #2']: 112,
      ['job #2']: 'job1',
      ['instance #2']: 'instance1',
    },
    {
      ['timestamp #2']: 1630000000,
      ['value #2']: 20,
      ['job #2']: 'job1',
      ['instance #2']: 'instance2',
    },
    {
      ['timestamp #2']: 1630000000,
      ['value #2']: 10,
      ['job #2']: 'job1',
      ['instance #2']: 'instance3',
    },
  ];
}

describe('No Transform', () => {
  test('output should be similar to input', () => {
    const input = generateMockFlattenQueriesResult();
    const output = transformData(input, []);
    expect(output).toEqual(input);
  });
});

describe('Merge Indexed Columns Transform', () => {
  test('output should be similar to input if column does not exist', () => {
    const input = generateMockFlattenQueriesResult();

    const mergeTransform: Transform = {
      kind: 'MergeIndexedColumns',
      spec: {
        column: 'non-existent-column',
      },
    };

    const output = transformData(input, [mergeTransform]);
    expect(output).toEqual(input);
  });

  test('output should have instance column merged', () => {
    const input = generateMockFlattenQueriesResult();

    const mergeTransform: Transform = {
      kind: 'MergeIndexedColumns',
      spec: {
        column: 'instance',
      },
    };

    const result = [
      // QUERY #1
      {
        ['timestamp #1']: 1630000000,
        ['value #1']: 55,
        ['job #1']: 'job1',
        ['instance']: 'instance1',
      },
      {
        ['timestamp #1']: 1630000000,
        ['value #1']: 33,
        ['job #1']: 'job1',
        ['instance']: 'instance2',
      },
      {
        ['timestamp #1']: 1630000000,
        ['value #1']: 45,
        ['job #1']: 'job1',
        ['instance']: 'instance3',
      },
      // QUERY #2
      {
        ['timestamp #2']: 1630000000,
        ['value #2']: 112,
        ['job #2']: 'job1',
        ['instance']: 'instance1',
      },
      {
        ['timestamp #2']: 1630000000,
        ['value #2']: 20,
        ['job #2']: 'job1',
        ['instance']: 'instance2',
      },
      {
        ['timestamp #2']: 1630000000,
        ['value #2']: 10,
        ['job #2']: 'job1',
        ['instance']: 'instance3',
      },
    ];

    const output = transformData(input, [mergeTransform]);
    expect(output).toEqual(result);
  });

  test('should be able to chain merge transforms', () => {
    const input = generateMockFlattenQueriesResult();

    const transforms: Transform[] = [
      {
        kind: 'MergeIndexedColumns',
        spec: {
          column: 'timestamp',
        },
      },
      {
        kind: 'MergeIndexedColumns',
        spec: {
          column: 'value',
        },
      },
      {
        kind: 'MergeIndexedColumns',
        spec: {
          column: 'job',
        },
      },
      {
        kind: 'MergeIndexedColumns',
        spec: {
          column: 'instance',
        },
      },
    ];

    const result = [
      // QUERY #1
      {
        ['timestamp']: 1630000000,
        ['value']: 55,
        ['job']: 'job1',
        ['instance']: 'instance1',
      },
      {
        ['timestamp']: 1630000000,
        ['value']: 33,
        ['job']: 'job1',
        ['instance']: 'instance2',
      },
      {
        ['timestamp']: 1630000000,
        ['value']: 45,
        ['job']: 'job1',
        ['instance']: 'instance3',
      },
      // QUERY #2
      {
        ['timestamp']: 1630000000,
        ['value']: 112,
        ['job']: 'job1',
        ['instance']: 'instance1',
      },
      {
        ['timestamp']: 1630000000,
        ['value']: 20,
        ['job']: 'job1',
        ['instance']: 'instance2',
      },
      {
        ['timestamp']: 1630000000,
        ['value']: 10,
        ['job']: 'job1',
        ['instance']: 'instance3',
      },
    ];

    const output = transformData(input, transforms);
    expect(output).toEqual(result);
  });
});

describe('Join By Column Transform', () => {
  test('output should contain one row if column does not exist', () => {
    const input = generateMockFlattenQueriesResult();

    const joinTransform: Transform = {
      kind: 'JoinByColumnValue',
      spec: {
        columns: ['non-existent-column'],
      },
    };

    const result = [
      {
        'timestamp #1': 1630000000,
        'timestamp #2': 1630000000,
        'value #1': 45,
        'value #2': 10,
        'job #1': 'job1',
        'job #2': 'job1',
        'instance #1': 'instance3',
        'instance #2': 'instance3',
      },
    ];

    const output = transformData(input, [joinTransform]);
    expect(output).toEqual(result);
  });

  test('output should have one column joined', () => {
    const input = generateMockFlattenQueriesResult();

    const transforms: Transform[] = [
      {
        kind: 'MergeIndexedColumns',
        spec: {
          column: 'instance',
        },
      },
      {
        kind: 'JoinByColumnValue',
        spec: {
          columns: ['instance'],
        },
      },
    ];

    const result = [
      // QUERY #1
      {
        ['timestamp #1']: 1630000000,
        ['timestamp #2']: 1630000000,

        ['value #1']: 55,
        ['value #2']: 112,

        ['job #1']: 'job1',
        ['job #2']: 'job1',

        ['instance']: 'instance1',
      },
      {
        ['timestamp #1']: 1630000000,
        ['timestamp #2']: 1630000000,

        ['value #1']: 33,
        ['value #2']: 20,

        ['job #1']: 'job1',
        ['job #2']: 'job1',

        ['instance']: 'instance2',
      },
      {
        ['timestamp #1']: 1630000000,
        ['timestamp #2']: 1630000000,

        ['value #1']: 45,
        ['value #2']: 10,

        ['job #1']: 'job1',
        ['job #2']: 'job1',

        ['instance']: 'instance3',
      },
    ];

    const output = transformData(input, transforms);
    expect(output).toEqual(result);
  });

  test('output should return last entry value in case of multiple entries with same column value', () => {
    const input: Array<Record<string, unknown>> = [
      {
        timestamp: 1630000000,
        value: 55,
        job: 'job1',
        instance: 'instance1',
        devices: '/dva/1',
      },
      {
        timestamp: 1630000000,
        value: 80,
        job: 'job1',
        instance: 'instance1',
        devices: '/dva/2',
      },
      {
        timestamp: 1630000000,
        value: 166,
        job: 'job1',
        instance: 'instance1',
        devices: '/dva/3',
      },
    ];

    const joinTransform: Transform = {
      kind: 'JoinByColumnValue',
      spec: {
        columns: ['instance'],
      },
    };

    const result: Array<Record<string, unknown>> = [
      {
        timestamp: 1630000000,
        value: 166,
        job: 'job1',
        instance: 'instance1',
        devices: '/dva/3',
      },
    ];

    const output = transformData(input, [joinTransform]);
    expect(output).toEqual(result);
  });
});

// LOGZ.IO CHANGE START:: percentage column transform
describe('Percentage Column Transform', () => {
  function generateSharesInput(): Array<Record<string, unknown>> {
    return [
      { timestamp: 1630000000, value: 3, mount: '/' },
      { timestamp: 1630000000, value: 1, mount: '/boot/efi' },
    ];
  }

  test('output should hold each row share of the column total as a fraction', () => {
    const output = transformData(generateSharesInput(), [{ kind: 'PercentageColumn', spec: { column: 'value' } }]);

    expect(output).toEqual([
      { timestamp: 1630000000, value: 3, mount: '/', 'value percentages': 0.75 },
      { timestamp: 1630000000, value: 1, mount: '/boot/efi', 'value percentages': 0.25 },
    ]);
  });

  test('output should use the configured output name', () => {
    const output = transformData(generateSharesInput(), [
      { kind: 'PercentageColumn', spec: { column: 'value', name: 'Share' } },
    ]);

    expect(output.map((row) => row['Share'])).toEqual([0.75, 0.25]);
    expect(output.some((row) => 'value percentages' in row)).toBe(false);
  });

  test('output should be zero for every row when the column total is zero', () => {
    const input: Array<Record<string, unknown>> = [
      { timestamp: 1630000000, value: 0, mount: '/' },
      { timestamp: 1630000000, value: 0, mount: '/boot/efi' },
    ];

    const output = transformData(input, [{ kind: 'PercentageColumn', spec: { column: 'value' } }]);

    expect(output.map((row) => row['value percentages'])).toEqual([0, 0]);
  });

  test('output should leave the share undefined and out of the total for a non-numeric cell', () => {
    const input: Array<Record<string, unknown>> = [
      { timestamp: 1630000000, value: 3, mount: '/' },
      { timestamp: 1630000000, value: 'n/a', mount: '/boot/efi' },
      { timestamp: 1630000000, mount: '/data' },
      { timestamp: 1630000000, value: 1, mount: '/home' },
    ];

    const output = transformData(input, [{ kind: 'PercentageColumn', spec: { column: 'value' } }]);

    expect(output.map((row) => row['value percentages'])).toEqual([0.75, undefined, undefined, 0.25]);
    expect(output.every((row) => 'value percentages' in row)).toBe(true);
  });

  test('output should be similar to input when the transform is disabled', () => {
    const input = generateSharesInput();

    const output = transformData(input, [{ kind: 'PercentageColumn', spec: { column: 'value', disabled: true } }]);

    expect(output).toEqual(input);
  });

  test('output should be similar to input when no column is configured', () => {
    const input = generateSharesInput();

    const output = transformData(input, [{ kind: 'PercentageColumn', spec: { column: '' } }]);

    expect(output).toEqual(input);
  });

  test('input rows should not be mutated', () => {
    const input = generateSharesInput();

    transformData(input, [{ kind: 'PercentageColumn', spec: { column: 'value' } }]);

    expect(input).toEqual(generateSharesInput());
  });

  test('should be able to chain with a merge transform', () => {
    const input = generateMockFlattenQueriesResult();

    const output = transformData(input, [
      { kind: 'MergeIndexedColumns', spec: { column: 'value' } },
      { kind: 'PercentageColumn', spec: { column: 'value' } },
    ]);

    // 55 + 33 + 45 + 112 + 20 + 10 = 275
    expect(output.map((row) => row['value percentages'])).toEqual([
      55 / 275,
      33 / 275,
      45 / 275,
      112 / 275,
      20 / 275,
      10 / 275,
    ]);
  });
});
// LOGZ.IO CHANGE END:: percentage column transform
