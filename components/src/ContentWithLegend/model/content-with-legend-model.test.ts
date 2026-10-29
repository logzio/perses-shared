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

import { createTheme } from '@mui/material';
// LOGZ.IO CHANGE:: LegendSize types the per-size legend limit tests
import { LegendSize, legendModes, legendSizes } from '../../model';
import * as table from '../../Table';
// LOGZ.IO CHANGE:: the minimum width of a right table legend
import { TABLE_PADDING } from '../../Legend/TableLegend';
import {
  ContentWithLegendLayoutOpts,
  // LOGZ.IO CHANGE:: per-size legend limits
  TABLE_LEGEND_MAX_SHARE,
  TABLE_LEGEND_SIZE,
  getContentWithLegendLayout,
} from './content-with-legend-model';

// Workaround to get spyOn to work without a cannot redefine property error.
// https://github.com/microsoft/TypeScript/issues/43081#issuecomment-1352352654
jest.mock('../../Table', () => ({
  __esModule: true,
  ...jest.requireActual('../../Table'),
}));

const mockMuiTheme = createTheme({});

describe('getContentWithLegendLayout', () => {
  describe('without legend options', () => {
    const layoutOpts: ContentWithLegendLayoutOpts = {
      width: 400,
      height: 200,
      spacing: 0,
      minChildrenWidth: 0,
      minChildrenHeight: 0,
      theme: mockMuiTheme,
      legendSize: 'medium',
    };

    test('does not show legend', () => {
      const layout = getContentWithLegendLayout(layoutOpts);
      expect(layout.legend.show).toBeFalsy();
    });

    test('gives content full width and height without a margin', () => {
      const layout = getContentWithLegendLayout(layoutOpts);
      expect(layout.content.width).toEqual(layoutOpts.width);
      expect(layout.content.height).toEqual(layoutOpts.height);
      expect(layout.margin).toEqual({ bottom: 0, right: 0 });
    });
  });

  describe.each(legendModes)('%s mode legend', (mode) => {
    describe.each(legendSizes)('%s size legend', (size) => {
      describe('with right oriented legend', () => {
        describe('with spacing', () => {
          const layoutOpts: ContentWithLegendLayoutOpts = {
            width: 800,
            height: 500,
            spacing: 10,
            minChildrenWidth: 0,
            minChildrenHeight: 0,
            legendProps: {
              options: {
                position: 'right',
                mode: mode,
              },
              data: [],
              selectedItems: 'ALL',
              onSelectedItemsChange: jest.fn(),
            },
            legendSize: size,
            theme: mockMuiTheme,
          };

          test('shows legend', () => {
            const layout = getContentWithLegendLayout(layoutOpts);
            expect(layout.legend.show).toBeTruthy();
          });

          test('lays out the content, spacing, and legend horizontally', () => {
            const layout = getContentWithLegendLayout(layoutOpts);
            expect(layout.content.width + layout.margin.right + layout.legend.width).toEqual(layoutOpts.width);
          });

          test('content and legend use full height', () => {
            const layout = getContentWithLegendLayout(layoutOpts);
            expect(layout.content.height).toEqual(layoutOpts.height);
            expect(layout.legend.height).toEqual(layoutOpts.height);
          });
        });

        describe('without spacing', () => {
          const layoutOpts: ContentWithLegendLayoutOpts = {
            width: 800,
            height: 500,
            spacing: 0,
            minChildrenWidth: 0,
            minChildrenHeight: 0,
            legendProps: {
              options: {
                position: 'right',
                mode: mode,
              },
              data: [],
              selectedItems: 'ALL',
              onSelectedItemsChange: jest.fn(),
            },
            legendSize: size,
            theme: mockMuiTheme,
          };

          test('shows legend', () => {
            const layout = getContentWithLegendLayout(layoutOpts);
            expect(layout.legend.show).toBeTruthy();
          });

          test('lays out the content, spacing, and legend horizontally', () => {
            const layout = getContentWithLegendLayout(layoutOpts);
            expect(layout.content.width + layout.legend.width).toEqual(layoutOpts.width);
          });

          test('content and legend use full height', () => {
            const layout = getContentWithLegendLayout(layoutOpts);
            expect(layout.content.height).toEqual(layoutOpts.height);
            expect(layout.legend.height).toEqual(layoutOpts.height);
          });
        });

        describe('without enough horizontal space for the legend', () => {
          const layoutOpts: ContentWithLegendLayoutOpts = {
            width: 200,
            height: 500,
            spacing: 10,
            minChildrenWidth: 200,
            minChildrenHeight: 0,
            legendProps: {
              options: {
                position: 'right',
                mode: mode,
              },
              data: [],
              selectedItems: 'ALL',
              onSelectedItemsChange: jest.fn(),
            },
            legendSize: size,
            theme: mockMuiTheme,
          };

          test('does not show legend', () => {
            const layout = getContentWithLegendLayout(layoutOpts);
            expect(layout.legend.show).toBeFalsy();
          });

          test('gives content full width and height without a margin', () => {
            const layout = getContentWithLegendLayout(layoutOpts);
            expect(layout.content.width).toEqual(layoutOpts.width);
            expect(layout.content.height).toEqual(layoutOpts.height);
            expect(layout.margin).toEqual({ bottom: 0, right: 0 });
          });
        });
      });

      describe('with bottom oriented legend', () => {
        describe('with spacing', () => {
          const layoutOpts: ContentWithLegendLayoutOpts = {
            width: 800,
            height: 500,
            spacing: 15,
            minChildrenWidth: 0,
            minChildrenHeight: 0,
            legendProps: {
              options: {
                position: 'bottom',
                mode: mode,
              },
              data: [],
              selectedItems: 'ALL',
              onSelectedItemsChange: jest.fn(),
            },
            legendSize: size,
            theme: mockMuiTheme,
          };

          test('shows legend', () => {
            const layout = getContentWithLegendLayout(layoutOpts);
            expect(layout.legend.show).toBeTruthy();
          });

          test('lays out the content, spacing, and legend vertically', () => {
            const layout = getContentWithLegendLayout(layoutOpts);
            expect(layout.content.height + layout.margin.bottom + layout.legend.height).toEqual(layoutOpts.height);
          });

          test('content and legend use full width', () => {
            const layout = getContentWithLegendLayout(layoutOpts);
            expect(layout.content.width).toEqual(layoutOpts.width);
            expect(layout.legend.width).toEqual(layoutOpts.width);
          });
        });
      });

      describe('without spacing', () => {
        const layoutOpts: ContentWithLegendLayoutOpts = {
          width: 800,
          height: 500,
          spacing: 0,
          minChildrenWidth: 0,
          minChildrenHeight: 0,
          legendProps: {
            options: {
              position: 'bottom',
              mode: mode,
            },
            data: [],
            selectedItems: 'ALL',
            onSelectedItemsChange: jest.fn(),
          },
          legendSize: size,
          theme: mockMuiTheme,
        };

        test('shows legend', () => {
          const layout = getContentWithLegendLayout(layoutOpts);
          expect(layout.legend.show).toBeTruthy();
        });

        test('lays out the content, spacing, and legend horizontally', () => {
          const layout = getContentWithLegendLayout(layoutOpts);
          expect(layout.content.height + layout.legend.height).toEqual(layoutOpts.height);
        });

        test('content and legend use full width', () => {
          const layout = getContentWithLegendLayout(layoutOpts);
          expect(layout.content.width).toEqual(layoutOpts.width);
          expect(layout.legend.width).toEqual(layoutOpts.width);
        });
      });

      describe('without enough vertical space for the legend', () => {
        const layoutOpts: ContentWithLegendLayoutOpts = {
          width: 300,
          height: 100,
          spacing: 10,
          minChildrenWidth: 0,
          minChildrenHeight: 100,
          legendProps: {
            options: {
              position: 'bottom',
              mode: mode,
            },
            data: [],
            selectedItems: 'ALL',
            onSelectedItemsChange: jest.fn(),
          },
          legendSize: size,
          theme: mockMuiTheme,
        };

        test('does not show legend', () => {
          const layout = getContentWithLegendLayout(layoutOpts);
          expect(layout.legend.show).toBeFalsy();
        });

        test('gives content full width and height without a margin', () => {
          const layout = getContentWithLegendLayout(layoutOpts);
          expect(layout.content.width).toEqual(layoutOpts.width);
          expect(layout.content.height).toEqual(layoutOpts.height);
          expect(layout.margin).toEqual({ bottom: 0, right: 0 });
        });
      });
    });
  });

  describe.each(legendSizes)('right positioned, size %s table legend with additional columns', (size) => {
    const layoutOpts: ContentWithLegendLayoutOpts = {
      width: 800,
      height: 500,
      spacing: 0,
      minChildrenWidth: 0,
      minChildrenHeight: 0,
      legendProps: {
        options: {
          position: 'right',
          mode: 'table',
        },
        tableProps: {
          columns: [
            {
              header: 'col 1',
              accessorKey: 'data.col1',
              width: 20,
            },
            {
              header: 'col 1',
              accessorKey: 'data.col1',
              width: 30,
            },
          ],
        },
        data: [],
        selectedItems: 'ALL',
        onSelectedItemsChange: jest.fn(),
      },
      legendSize: size,
      theme: mockMuiTheme,
    };

    test('shows legend', () => {
      const layout = getContentWithLegendLayout(layoutOpts);
      expect(layout.legend.show).toBeTruthy();
    });

    test('lays out the content, spacing, and legend horizontally', () => {
      const layout = getContentWithLegendLayout(layoutOpts);
      expect(layout.content.width + layout.legend.width).toEqual(layoutOpts.width);
    });

    test('legend width accounts for columns', () => {
      const layout = getContentWithLegendLayout(layoutOpts);
      expect(layout.legend.width).toEqual(TABLE_LEGEND_SIZE[size]['right'] + 50);
    });
  });

  describe('bottom positioned table legend with less items than size calls for', () => {
    test('reduces the size of the legend based on the number of items', () => {
      const layoutOpts: ContentWithLegendLayoutOpts = {
        width: 800,
        height: 500,
        spacing: 15,
        minChildrenWidth: 0,
        minChildrenHeight: 0,
        legendProps: {
          options: {
            position: 'bottom',
            mode: 'table',
          },
          data: [
            {
              id: '1',
              label: 'one',
              color: '#ff0000',
            },
            {
              id: '2',
              label: 'two',
              color: '#00FF00',
            },
          ],
          selectedItems: 'ALL',
          onSelectedItemsChange: jest.fn(),
        },
        legendSize: 'medium',
        theme: mockMuiTheme,
      };

      const MOCK_TABLE_CELL_HEIGHT = 20;
      jest.spyOn(table, 'getTableCellLayout').mockReturnValue({
        height: MOCK_TABLE_CELL_HEIGHT,
      });

      const layout = getContentWithLegendLayout(layoutOpts);
      expect(layout.legend.height).toBeLessThan(TABLE_LEGEND_SIZE['medium']['bottom'] * MOCK_TABLE_CELL_HEIGHT);

      // Height is for 3 rows because there are 2 legend items + 1 header row.
      expect(layout.legend.height).toEqual(3 * MOCK_TABLE_CELL_HEIGHT);
    });
  });

  // LOGZ.IO CHANGE START:: Limit the table legend to a part of the panel, by legend size
  describe('bottom positioned table legend with more items than fit the panel height', () => {
    const MOCK_TABLE_CELL_HEIGHT = 20;

    const getLayout = (
      height: number,
      legendSize: LegendSize,
      minChildrenHeight = 0
    ): ReturnType<typeof getContentWithLegendLayout> => {
      jest.spyOn(table, 'getTableCellLayout').mockReturnValue({
        height: MOCK_TABLE_CELL_HEIGHT,
      });

      return getContentWithLegendLayout({
        width: 800,
        height,
        spacing: 0,
        minChildrenWidth: 0,
        minChildrenHeight,
        legendProps: {
          options: {
            position: 'bottom',
            mode: 'table',
          },
          data: Array.from({ length: 10 }, (_, index) => ({
            id: `${index}`,
            label: `series ${index}`,
            color: '#ff0000',
          })),
          selectedItems: 'ALL',
          onSelectedItemsChange: jest.fn(),
        },
        legendSize,
        theme: mockMuiTheme,
      });
    };

    test.each(legendSizes)('uses the rows of the %s size when the panel is tall', (size) => {
      expect(getLayout(1000, size).legend.height).toEqual(TABLE_LEGEND_SIZE[size]['bottom'] * MOCK_TABLE_CELL_HEIGHT);
    });

    test.each(legendSizes)('shows only the rows that fit in the %s share of a short panel', (size) => {
      const rowsThatFit = Math.floor((300 * TABLE_LEGEND_MAX_SHARE[size]['bottom']) / MOCK_TABLE_CELL_HEIGHT);
      const layout = getLayout(300, size);

      expect(layout.legend.height).toEqual(rowsThatFit * MOCK_TABLE_CELL_HEIGHT);
      expect(layout.content.height).toEqual(300 - rowsThatFit * MOCK_TABLE_CELL_HEIGHT);
    });

    test('keeps a small legend shorter than a medium one in a short panel', () => {
      expect(getLayout(200, 'small').legend.height).toBeLessThan(getLayout(200, 'medium').legend.height);
    });

    test('keeps the header and one row when the legend share holds less', () => {
      const layout = getLayout(150, 'medium');

      expect(layout.legend.show).toBeTruthy();
      expect(layout.legend.height).toEqual(2 * MOCK_TABLE_CELL_HEIGHT);
    });

    test('keeps the legend hidden when it does not fit before the limit', () => {
      // A medium legend of 6 rows leaves 30px of a 150px panel, less than the 50px the content needs.
      expect(getLayout(150, 'medium', 50).legend.show).toBeFalsy();
    });
  });

  describe('right positioned table legend wider than its share of the panel width', () => {
    const VALUE_COLUMN_WIDTH = 72;

    const getLayout = (
      width: number,
      legendSize: LegendSize,
      minChildrenWidth = 0
    ): ReturnType<typeof getContentWithLegendLayout> =>
      getContentWithLegendLayout({
        width,
        height: 300,
        spacing: 0,
        minChildrenWidth,
        minChildrenHeight: 0,
        legendProps: {
          options: {
            position: 'right',
            mode: 'table',
          },
          tableProps: {
            columns: [{ header: 'col 1', accessorKey: 'data.col1', width: VALUE_COLUMN_WIDTH }],
          },
          data: [],
          selectedItems: 'ALL',
          onSelectedItemsChange: jest.fn(),
        },
        legendSize,
        theme: mockMuiTheme,
      });

    test.each(legendSizes)('uses the width of the %s size when the panel is wide', (size) => {
      expect(getLayout(1000, size).legend.width).toEqual(TABLE_LEGEND_SIZE[size]['right'] + VALUE_COLUMN_WIDTH);
    });

    test.each(legendSizes)('limits the %s legend to its share of a narrow panel', (size) => {
      const layout = getLayout(600, size);

      expect(layout.legend.show).toBeTruthy();
      expect(layout.legend.width).toEqual(600 * TABLE_LEGEND_MAX_SHARE[size]['right']);
      expect(layout.content.width).toEqual(600 - layout.legend.width);
    });

    test('keeps a small legend narrower than a medium one in a narrow panel', () => {
      expect(getLayout(400, 'small').legend.width).toBeLessThan(getLayout(400, 'medium').legend.width);
    });

    test('keeps the legend hidden when it does not fit before the limit', () => {
      // A medium legend of 322px leaves 78px of a 400px panel. With the 50% share, 200px would be left.
      expect(getLayout(400, 'medium', 100).legend.show).toBeFalsy();
    });

    test('keeps the minimum table width when the share is narrower', () => {
      // 35% of 450px is less than the value column, the table padding and the minimum name column.
      expect(getLayout(450, 'small').legend.width).toEqual(
        VALUE_COLUMN_WIDTH + TABLE_PADDING + table.DEFAULT_COLUMN_MIN_WIDTH
      );
    });
  });
  // LOGZ.IO CHANGE END:: Limit the table legend to a part of the panel, by legend size
});
