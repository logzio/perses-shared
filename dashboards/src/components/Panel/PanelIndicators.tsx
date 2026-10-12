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

// LOGZ.IO CHANGE:: panel's warning indicators (query errors, series limit, notices)
// They render before the panel title, at a fixed spot on every panel, so revealing the hover-only
// actions never moves them and they never move the actions. The refetch spinner stays in
// `PanelActions`: it comes and goes on every refresh and would shift the title if it lived here.

import { ReactElement, ReactNode, useMemo } from 'react';
import { Stack } from '@mui/material';
import { InfoTooltip } from '@perses-dev/components';
import { PanelNotice, QueryData, SERIES_LIMIT_NOTICE_KIND } from '@perses-dev/plugin-system';
import { Notice } from '@perses-dev/spec';
import AlertIcon from 'mdi-material-ui/Alert';
import AlertCircleIcon from 'mdi-material-ui/AlertCircle';
import ChartLineIcon from 'mdi-material-ui/ChartLine';
import InformationOutlineIcon from 'mdi-material-ui/InformationOutline';
import { HeaderIconButton } from './HeaderIconButton';

const noticeTypeToIcon: Record<Notice['type'], ReactNode> = {
  error: <AlertCircleIcon color="error" />,
  warning: <AlertIcon fontSize="inherit" color="warning" />,
  info: <InformationOutlineIcon fontSize="inherit" color="info" />,
};

const NOTICE_SEVERITY_RANK: Record<Notice['type'], number> = { error: 0, warning: 1, info: 2 };

const mostSevereNotice = (notices: Notice[]): Notice | undefined =>
  notices.reduce<Notice | undefined>(
    (worst, notice) =>
      worst === undefined || NOTICE_SEVERITY_RANK[notice.type] < NOTICE_SEVERITY_RANK[worst.type] ? notice : worst,
    undefined
  );

const describeNotices = (notices: Notice[]): string => [...new Set(notices.map(({ message }) => message))].join('\n');

export interface PanelIndicatorsProps {
  queryResults: QueryData[];
}

export function PanelIndicators({ queryResults }: PanelIndicatorsProps): ReactElement | null {
  const errorIndicator = useMemo((): ReactNode | undefined => {
    const queryErrors = queryResults.filter((q) => q.error);

    if (queryErrors.length === 0) {
      return undefined;
    }

    const errorTexts = queryErrors
      .map((q) => q.error)
      .map((e) => e.message)
      .join('\n');

    return (
      <InfoTooltip description={errorTexts}>
        <HeaderIconButton aria-label="panel errors" size="small">
          <AlertIcon fontSize="inherit" sx={{ color: (theme) => theme.palette.error.main }} />
        </HeaderIconButton>
      </InfoTooltip>
    );
  }, [queryResults]);

  // One indicator per notice kind, so a general notice cannot hide the series limit
  const { seriesLimitNotices, generalNotices } = useMemo(() => {
    const notices: PanelNotice[] = queryResults.flatMap((q) => q.data?.metadata?.notices ?? []);

    return {
      seriesLimitNotices: notices.filter(({ kind }) => kind === SERIES_LIMIT_NOTICE_KIND),
      generalNotices: notices.filter(({ kind }) => kind !== SERIES_LIMIT_NOTICE_KIND),
    };
  }, [queryResults]);

  const seriesLimitIndicator = useMemo((): ReactNode | undefined => {
    if (seriesLimitNotices.length === 0) {
      return undefined;
    }

    return (
      <InfoTooltip description={describeNotices(seriesLimitNotices)}>
        <HeaderIconButton aria-label="panel series limit notices" size="small">
          <ChartLineIcon fontSize="inherit" color="warning" />
        </HeaderIconButton>
      </InfoTooltip>
    );
  }, [seriesLimitNotices]);

  const noticesIndicator = useMemo((): ReactNode | undefined => {
    const worstNotice = mostSevereNotice(generalNotices);

    if (worstNotice === undefined) {
      return undefined;
    }

    return (
      <InfoTooltip description={describeNotices(generalNotices)}>
        <HeaderIconButton aria-label="panel notices" size="small">
          {noticeTypeToIcon[worstNotice.type]}
        </HeaderIconButton>
      </InfoTooltip>
    );
  }, [generalNotices]);

  if (!errorIndicator && !seriesLimitIndicator && !noticesIndicator) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="center" flexShrink={0} sx={{ mr: 0.5 }}>
      {errorIndicator}
      {seriesLimitIndicator}
      {noticesIndicator}
    </Stack>
  );
}
