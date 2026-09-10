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

import { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { VirtuosoMockContext } from 'react-virtuoso';
import { Table } from './Table';
import { TableProps } from './model/table-model';

type MockTableData = {
  id: string;
  label: string;
  value: number;
};

const COLUMNS: TableProps<MockTableData>['columns'] = [
  { accessorKey: 'label', header: 'Label' },
  { accessorKey: 'value', header: 'Value' },
];

const MOCK_ITEM_HEIGHT = 100;
const VIEWPORT_HEIGHT = 600;

function generateMockTableData(count: number): MockTableData[] {
  const data: MockTableData[] = [];
  for (let i = 0; i < count; i++) {
    data.push({ id: `row${i}`, label: `label ${i}`, value: i });
  }
  return data;
}

function TestTable({ data, width = 300 }: { data: MockTableData[]; width?: number }): ReactElement {
  return (
    <VirtuosoMockContext.Provider value={{ viewportHeight: VIEWPORT_HEIGHT, itemHeight: MOCK_ITEM_HEIGHT }}>
      <Table data={data} columns={COLUMNS} height={VIEWPORT_HEIGHT} width={width} />
    </VirtuosoMockContext.Provider>
  );
}

describe('VirtualizedTable', () => {
  it('should keep the same table element when re-rendered with unchanged data', () => {
    const data = generateMockTableData(5);
    const { rerender } = render(<TestTable data={data} />);
    const tableBeforeRerender = screen.getByRole('table');

    rerender(<TestTable data={data} />);

    expect(screen.getByRole('table')).toBe(tableBeforeRerender);
  });

  it('should keep the same table element when the data is refreshed with a new array', () => {
    const { rerender } = render(<TestTable data={generateMockTableData(5)} />);
    const tableBeforeRefresh = screen.getByRole('table');

    // A dashboard refresh hands the table a brand new array with the same rows.
    rerender(<TestTable data={generateMockTableData(5)} />);

    expect(screen.getByRole('table')).toBe(tableBeforeRefresh);
  });

  it('should apply a new width to the existing table element when the panel is resized', () => {
    const data = generateMockTableData(5);
    const { rerender } = render(<TestTable data={data} width={300} />);
    const tableBeforeResize = screen.getByRole('table');

    rerender(<TestTable data={data} width={500} />);

    expect(screen.getByRole('table')).toBe(tableBeforeResize);
    expect(screen.getByRole('table')).toHaveAttribute('width', '500');
  });
});
