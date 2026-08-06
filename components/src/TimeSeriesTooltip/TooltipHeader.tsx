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

import { Box, Typography, Stack, Switch, IconButton } from '@mui/material';
import { memo, ReactElement } from 'react';
import Close from 'mdi-material-ui/Close';
import { getDateAndTime } from '../utils';
import { NearbySeriesArray } from './types';
import { TOOLTIP_BG_COLOR_FALLBACK, TOOLTIP_MAX_WIDTH } from './tooltip-model';

export interface TooltipHeaderProps {
  nearbySeries: NearbySeriesArray;
  totalSeries: number;
  isTooltipPinned: boolean;
  showAllSeries: boolean;
  enablePinning?: boolean;
  isSingleMode?: boolean; // LOGZ.IO CHANGE:: Single tooltip mode shows the toggle whenever >1 series is hidden
  onShowAllClick?: (checked: boolean) => void;
  onUnpinClick?: () => void;
}

export const TooltipHeader = memo(function TooltipHeader({
  nearbySeries,
  totalSeries,
  isTooltipPinned,
  showAllSeries,
  enablePinning = true,
  isSingleMode = false, // LOGZ.IO CHANGE:: Single tooltip mode toggle visibility
  onShowAllClick,
  onUnpinClick,
}: TooltipHeaderProps) {
  const seriesTimeMs = nearbySeries[0]?.date ?? null;
  if (seriesTimeMs === null) {
    return null;
  }

  const formatTimeSeriesHeader = (timeMs: number): ReactElement => {
    const { formattedTime, formattedDate } = getDateAndTime(timeMs);
    return (
      <Box>
        <Typography
          variant="caption"
          sx={(theme) => ({
            // LOGZ.IO CHANGE START:: Drilldown panel
            color: theme.palette.text.primary,
            fontSize: 12,
            // LOGZ.IO CHANGE END:: Drilldown panel
          })}
        >
          {/* LOGZ.IO CHANGE:: 0.54.0 moved the " - " separator out of `getDateAndTime` into each
              caller's own markup, so render it here. */}
          {`${formattedDate} - `}
        </Typography>
        <Typography fontSize={12} variant="caption">
          <strong>{formattedTime}</strong>
        </Typography>
      </Box>
    );
  };

  // TODO: accurately calc whether more series are outside scrollable region using yBuffer, avg series name length, TOOLTIP_MAX_HEIGHT
  // LOGZ.IO CHANGE START:: Show All toggle visibility — single hides all but one line (useful at >1 series), nearby only when crowded (>5)
  const hasHiddenSeries = isSingleMode ? totalSeries > 1 : totalSeries > 5;
  const showAllSeriesToggle = enablePinning && (hasHiddenSeries || showAllSeries);
  // LOGZ.IO CHANGE END:: Show All toggle visibility — single hides all but one line (useful at >1 series), nearby only when crowded (>5)

  return (
    <Box
      sx={(theme) => ({
        width: '100%',
        maxWidth: TOOLTIP_MAX_WIDTH,
        padding: theme.spacing(1.5, 1, 0.5, 1), // LOGZ.IO CHANGE:: Tighter horizontal padding for a more compact tooltip
        top: 0,
        left: 0,
        // LOGZ.IO CHANGE START:: Drilldown panel
        backgroundColor: theme.palette.background.paper ?? TOOLTIP_BG_COLOR_FALLBACK,
        borderBottom: `1px solid ${theme.palette.divider}`,
        position: 'sticky',
        // LOGZ.IO CHANGE END:: Drilldown panel
      })}
    >
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          justifyContent: 'start',
          alignItems: 'center',
          paddingBottom: 0.5,
        }}
      >
        {formatTimeSeriesHeader(seriesTimeMs)}
        <Stack direction="row" gap={0.5} sx={{ marginLeft: 'auto' }}>
          {showAllSeriesToggle && (
            <Stack direction="row" gap={0.5} alignItems="center" sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 11 }}>Show All</Typography>
              <Switch
                checked={showAllSeries}
                size="small"
                onChange={(_, checked) => {
                  if (onShowAllClick !== undefined) {
                    return onShowAllClick(checked);
                  }
                }}
                sx={(theme) => ({
                  '& .MuiSwitch-switchBase': {
                    color: theme.palette.common.white,
                  },
                  '& .MuiSwitch-track': {
                    backgroundColor: theme.palette.common.white,
                  },
                })}
              />
            </Stack>
          )}
          {enablePinning && (
            <Stack direction="row" alignItems="center">
              {/* LOGZ.IO CHANGE START:: Drilldown panel */}
              {isTooltipPinned && (
                <IconButton
                  size="small"
                  onClick={() => {
                    if (onUnpinClick !== undefined) {
                      onUnpinClick();
                    }
                  }}
                >
                  <Close sx={{ fontSize: 14 }} />
                </IconButton>
              )}
              {/* LOGZ.IO CHANGE END:: Drilldown panel */}
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
});
