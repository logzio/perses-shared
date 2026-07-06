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

import { useState } from 'react';
import { Box } from '@mui/material';
import { Virtuoso } from 'react-virtuoso';
import { isNil } from 'lodash';
import { TooltipContentProps } from './TooltipContent';
import { SeriesInfo } from './SeriesInfo';

export interface VirtualizedSeriesProps {
  allowActions: TooltipContentProps['allowActions'];
  wrapLabels: TooltipContentProps['wrapLabels'];
  onSelected?: TooltipContentProps['onSelected'];
  sortedFocusedSeries: NonNullable<TooltipContentProps['series']>;
}

// LOGZ.IO CHANGE FILE:: Performance optimization

// Approximate rendered height of one SeriesInfo row; the estimate only has to hold until
// Virtuoso reports the measured list height. 300 mirrors the max height cap below.
const SERIES_ROW_HEIGHT_PX = 22;
const MAX_LIST_HEIGHT_PX = 300;
const MAX_INITIAL_ITEMS = Math.ceil(MAX_LIST_HEIGHT_PX / SERIES_ROW_HEIGHT_PX);

export const VirtualizedSeries: React.FC<VirtualizedSeriesProps> = ({
  allowActions,
  sortedFocusedSeries,
  wrapLabels,
  onSelected,
}) => {
  // Seed the list height from the row count so the tooltip's first paint already shows the full
  // content. Mounting at a tiny fixed height showed half a row until Virtuoso measured itself,
  // which stays frozen on screen whenever the first hover blocks the main thread.
  const [height, setHeight] = useState(() =>
    Math.min(sortedFocusedSeries.length * SERIES_ROW_HEIGHT_PX, MAX_LIST_HEIGHT_PX)
  );
  return (
    <Box
      sx={(theme) => ({
        padding: theme.spacing(0.5, 1), // LOGZ.IO CHANGE:: Tighter horizontal padding for a more compact tooltip
        width: 500,
        // LOGZ.IO CHANGE START:: Drilldown panel
        borderBottom: allowActions ? `1px solid ${theme.palette.divider}` : undefined,
        // LOGZ.IO CHANGE END:: Drilldown panel
      })}
    >
      <Virtuoso
        role="list"
        style={{ height: height > MAX_LIST_HEIGHT_PX ? MAX_LIST_HEIGHT_PX : height, width: '100%' }}
        totalListHeightChanged={setHeight}
        totalCount={sortedFocusedSeries.length}
        // Render the visible rows in the very first pass instead of waiting for the
        // post-mount viewport measurement (which can be delayed by long tasks).
        initialItemCount={Math.min(sortedFocusedSeries.length, MAX_INITIAL_ITEMS)}
        defaultItemHeight={SERIES_ROW_HEIGHT_PX}
        data={sortedFocusedSeries}
        itemContent={(index, data) => {
          if (isNil(data.datumIdx) || isNil(data.seriesIdx)) return null;

          const key = data.seriesIdx.toString() + data.datumIdx.toString();

          return (
            <SeriesInfo
              key={key}
              seriesName={data.seriesName}
              y={data.y}
              formattedY={data.formattedY}
              markerColor={data.markerColor}
              totalSeries={sortedFocusedSeries.length}
              wrapLabels={wrapLabels}
              emphasizeText={data.isClosestToCursor}
              // LOGZ.IO CHANGE START:: Drilldown panel
              isSelected={data.isSelected}
              isSelectable={!!data.metadata?.isSelectable ?? true}
              onSelected={onSelected ? (): void => onSelected(data.seriesIdx!) : undefined}
              // LOGZ.IO CHANGE END:: Drilldown panel
            />
          );
        }}
      />
    </Box>
  );
};
