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

import { PercentageColumnTransform, Transform } from '../model'; // LOGZ.IO CHANGE:: percentage column transform

/*
 * Join: Regroup rows with equal cell value in a column.
 * If there are multiple line with same value, next row values override the current one
 *
 * Example: Join on 'mount' column
 * INPUT:
 * | timestamp  | value #1 | value #3 | mount     |
 * |------------|----------|----------|-----------|
 * | 1630000000 | 1        |          | /         |
 * | 1630000000 | 2        |          | /boot/efi |
 * | 1630000000 |          | 3        | /         |
 * | 1630000000 |          | 4        | /boot/efi |
 *
 * OUTPUT:
 * | timestamp  | value #1 | value #3 | mount     |
 * |------------|----------|----------|-----------|
 * | 1630000000 | 1        | 3        | /         |
 * | 1630000000 | 2        | 4        | /boot/efi |
 */
export function applyJoinTransform(
  data: Array<Record<string, unknown>>,
  columns: string[]
): Array<Record<string, unknown>> {
  // If column is undefined or empty, return data as is
  if (columns.length === 0) {
    return data;
  }

  const rowHashed: { [key: string]: Record<string, unknown> } = {};

  for (const row of data) {
    const rowHash = Object.keys(row)
      .filter((k) => columns.includes(k))
      .map((k) => row[k])
      .join('|');

    const rowHashedValue = rowHashed[rowHash];
    if (rowHashedValue) {
      rowHashed[rowHash] = { ...rowHashedValue, ...row };
    } else {
      rowHashed[rowHash] = { ...row };
    }
  }
  return Object.values(rowHashed);
}

/*
 * Merges selected columns into a single column.
 *
 * Example: Merge columns 'value #1' and 'value #2' into a single column 'MERGED'
 * INPUT:
 * +------------+----------+----------+-----------+-----------+
 * | timestamp  | value #1 | value #2 | mount #1  | mount #2  |
 * +------------+----------+----------+-----------+-----------+
 * | 1630000000 | 1        |          | /         |           |
 * | 1630000000 | 2        |          | /boot/efi |           |
 * | 1630000000 |          | 3        |           | /         |
 * | 1630000000 |          | 4        |           | /boot/efi |
 * +------------+----------+----------+-----------+-----------+
 *
 * OUTPUT:
 * +------------+--------+-----------+-----------+
 * | timestamp  | MERGED | mount #1  | mount #2  |
 * +------------+--------+-----------+-----------+
 * | 1630000000 | 1      | /         |           |
 * | 1630000000 | 2      | /boot/efi |           |
 * | 1630000000 | 2      |           | /         |
 * | 1630000000 | 3      |           | /boot/efi |
 * +------------+--------+-----------+-----------+
 */
export function applyMergeColumnsTransform(
  data: Array<Record<string, unknown>>,
  selectedColumns: string[],
  outputName: string
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];

  for (const row of data) {
    const columns = Object.keys(row).filter((k) => selectedColumns.includes(k));

    const selectedColumnValues: Record<string, unknown> = {};

    for (const column of columns) {
      selectedColumnValues[column] = row[column];
      delete row[column];
    }

    for (const column of columns) {
      result.push({ ...row, [outputName]: selectedColumnValues[column] });
    }

    if (columns.length === 0) {
      result.push(row);
    }
  }

  return result;
}

/*
 * Merge Indexed Columns: All indexed columns are merged to one column
 *
 * Example: Join on 'value' column
 * INPUT:
 * | timestamp #1 | timestamp #2 | value #1 | value #2 | instance #1 | instance #2 |
 * |--------------|--------------|----------|----------|-------------|-------------|
 * | 1630000000   |              | 55       |          | toto        |             |
 * | 1630000000   |              | 33       |          | toto        |             |
 * | 1630000000   |              | 45       |          | toto        |             |
 * |              | 1630000000   |          | 112      |             | titi        |
 * |              | 1630000000   |          | 20       |             | titi        |
 * |              | 1630000000   |          | 10       |             | titi        |
 *
 * OUTPUT:
 * | timestamp #1 | timestamp #2 | value | instance #1 | instance #2 |
 * |--------------|--------------|-------|-------------|-------------|
 * | 1630000000   |              | 55    | toto        |             |
 * | 1630000000   |              | 33    | toto        |             |
 * | 1630000000   |              | 45    | toto        |             |
 * |              | 1630000000   | 112   |             | titi        |
 * |              | 1630000000   | 20    |             | titi        |
 * |              | 1630000000   | 10    |             | titi        |
 */
export function applyMergeIndexedColumnsTransform(
  data: Array<Record<string, unknown>>,
  column: string
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];

  for (const entry of data) {
    const indexedColumns = Object.keys(entry).filter((k) =>
      new RegExp('^((' + column + ' #\\d+)|(' + column + '))$').test(k)
    );
    const indexedColumnValues: Record<string, unknown> = {};

    for (const indexedColumn of indexedColumns) {
      indexedColumnValues[indexedColumn] = entry[indexedColumn];
      delete entry[indexedColumn];
    }

    for (const indexedColumn of indexedColumns) {
      result.push({ ...entry, [column]: indexedColumnValues[indexedColumn] });
    }

    if (indexedColumns.length === 0) {
      result.push(entry);
    }
  }

  return result;
}

/*
 * Merge Indexed Columns: All indexed columns are merged to one column
 *
 * INPUT:
 * | timestamp  | value #1 | value #2 | mount #1  | mount #2  | instance #1 | instance #2 | env #1 | env #2 |
 * |------------|----------|----------|-----------|-----------|-------------|-------------|--------|--------|
 * | 1630000000 | 1        |          | /         |           | test:44     |             | prd    |        |
 * | 1630000000 | 2        |          | /boot/efi |           | test:44     |             | prd    |        |
 * | 1630000000 |          | 5        |           | /         |             | test:44     |        | prd    |
 * | 1630000000 |          | 6        |           | /boot/efi |             | test:44     |        | prd    |
 *
 * OUTPUT:
 * | timestamp  | value #1 | value #2 | mount     | instance | env |
 * |------------|----------|----------|-----------|----------|-----|
 * | 1630000000 | 1        | 5        | /         | test:44  | prd |
 * | 1630000000 | 2        | 6        | /boot/efi | test:44  | prd |
 */
export function applyMergeSeriesTransform(data: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  let result: Array<Record<string, unknown>> = [...data];

  const labelColumns = Array.from(
    new Set(
      data
        .flatMap(Object.keys)
        .map((label) => label.replace(/ #\d+/, ''))
        .filter((label) => label !== 'value')
    )
  );

  for (const label of labelColumns) {
    result = applyMergeIndexedColumnsTransform(result, label);
  }

  result = applyJoinTransform(result, labelColumns);

  return result;
}

// LOGZ.IO CHANGE START:: percentage column transform
/*
 * Percentage Column: adds a column holding each row's share of a column's total, as a fraction.
 * The total sums every row with a finite number in the column; a row without one gets no share
 * and does not count toward the total. A zero total gives every row 0.
 *
 * Example: Share of 'value' as 'value percentages'
 * INPUT:
 * | timestamp  | value | mount     |
 * |------------|-------|-----------|
 * | 1630000000 | 3     | /         |
 * | 1630000000 | 1     | /boot/efi |
 *
 * OUTPUT:
 * | timestamp  | value | mount     | value percentages |
 * |------------|-------|-----------|-------------------|
 * | 1630000000 | 3     | /         | 0.75              |
 * | 1630000000 | 1     | /boot/efi | 0.25              |
 */
/** The column a PercentageColumn transform writes: the configured name, else `<column> percentages`. */
export function getPercentageColumnName(spec: PercentageColumnTransform['spec']): string {
  return spec.name || `${spec.column} percentages`;
}

export function applyPercentageColumnTransform(
  data: Array<Record<string, unknown>>,
  column: string,
  outputName: string
): Array<Record<string, unknown>> {
  const isShareable = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  const total = data.reduce((sum, row) => {
    const value = row[column];
    return isShareable(value) ? sum + value : sum;
  }, 0);

  return data.map((row) => {
    const value = row[column];
    if (!isShareable(value)) {
      return { ...row, [outputName]: undefined };
    }
    return { ...row, [outputName]: total === 0 ? 0 : value / total };
  });
}
// LOGZ.IO CHANGE END:: percentage column transform

/*
 * Transforms query data with the given transforms
 */
export function transformData(
  data: Array<Record<string, unknown>>,
  transforms: Transform[]
): Array<Record<string, unknown>> {
  let result: Array<Record<string, unknown>> = data;

  // Apply transforms by their orders
  for (const transform of transforms ?? []) {
    if (transform.spec.disabled) continue;

    switch (transform.kind) {
      case 'JoinByColumnValue': {
        if (transform.spec.columns && transform.spec.columns.length > 0) {
          result = applyJoinTransform(result, transform.spec.columns);
        }
        break;
      }
      case 'MergeIndexedColumns': {
        if (transform.spec.column) {
          result = applyMergeIndexedColumnsTransform(result, transform.spec.column);
        }
        break;
      }
      case 'MergeColumns': {
        if (transform.spec.columns && transform.spec.columns.length > 0 && transform.spec.name) {
          result = applyMergeColumnsTransform(result, transform.spec.columns, transform.spec.name);
        }
        break;
      }
      // LOGZ.IO CHANGE START:: percentage column transform
      case 'PercentageColumn': {
        if (transform.spec.column) {
          result = applyPercentageColumnTransform(
            result,
            transform.spec.column,
            getPercentageColumnName(transform.spec)
          );
        }
        break;
      }
      // LOGZ.IO CHANGE END:: percentage column transform
      case 'MergeSeries': {
        result = applyMergeSeriesTransform(result);
        break;
      }
    }
  }

  // Ordering data column alphabetically
  result = result.map((row) => {
    return Object.keys(row)
      .sort()
      .reduce((obj: Record<string, unknown>, key: string) => {
        obj[key] = row[key];
        return obj;
      }, {});
  });
  return result;
}
