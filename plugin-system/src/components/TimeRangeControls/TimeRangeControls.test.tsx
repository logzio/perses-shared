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

import userEvent from '@testing-library/user-event';
import { screen, RenderOptions, render, RenderResult } from '@testing-library/react';
import { DurationString } from '@perses-dev/spec';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactElement } from 'react';
import { SnackbarProvider, TimeRangePickerComponent } from '@perses-dev/components';
import { TimeRangeProviderBasic, TimeRangeProviderWithQueryParams } from '@perses-dev/plugin-system';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';
import { useTimeZoneParams } from '../../runtime/TimeRangeProvider/query-params';
import { TimeRangeControls } from './TimeRangeControls';

/**
 * Test helper to render a React component with some common app-level providers wrapped around it.
 */
export function renderWithContext(ui: React.ReactElement, options?: Omit<RenderOptions, 'queries'>): RenderResult {
  // Create a new QueryClient for each test to avoid caching issues
  const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } } });

  const BaseRender = (): ReactElement => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <QueryParamProvider adapter={ReactRouter6Adapter}>
          <SnackbarProvider anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>{ui}</SnackbarProvider>
        </QueryParamProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );

  return render(<BaseRender />, options);
}

describe('TimeRangeControls', () => {
  const testDefaultTimeRange = { pastDuration: '30m' as DurationString };
  const testDefaultRefreshInterval = '0s';

  const ControlsWithTZ = (): ReactElement => {
    const { timeZone, setTimeZone } = useTimeZoneParams('local');
    return <TimeRangeControls timeZone={timeZone} onTimeZoneChange={(tz) => setTimeZone(tz.value)} />;
  };

  const ControlsWithCustomPicker = ({ picker }: { picker: TimeRangePickerComponent }): ReactElement => {
    const { timeZone, setTimeZone } = useTimeZoneParams('local');
    return (
      <TimeRangeControls
        timeZone={timeZone}
        onTimeZoneChange={(tz) => setTimeZone(tz.value)}
        timeRangePicker={picker}
      />
    );
  };

  const renderTimeRangeControls = (testURLParams: boolean): void => {
    renderWithContext(
      <>
        {testURLParams ? (
          <TimeRangeProviderWithQueryParams
            initialRefreshInterval={testDefaultRefreshInterval}
            initialTimeRange={testDefaultTimeRange}
          >
            <ControlsWithTZ />
          </TimeRangeProviderWithQueryParams>
        ) : (
          <TimeRangeProviderBasic
            initialRefreshInterval={testDefaultRefreshInterval}
            initialTimeRange={testDefaultTimeRange}
          >
            <ControlsWithTZ />
          </TimeRangeProviderBasic>
        )}
      </>,
      undefined
    );
  };

  it('should default to dashboard duration and update selected time option when clicked', async () => {
    renderTimeRangeControls(false);
    expect(screen.getByText('Last 30 minutes')).toBeInTheDocument();
    const dateButton = await screen.findByLabelText(/time range/i, { selector: '[role="combobox"]' });
    userEvent.click(dateButton);
    const firstSelected = screen.getByRole('option', { name: 'Last 5 minutes' });
    userEvent.click(firstSelected);
    expect(dateButton).toHaveTextContent(/5 minutes/i);
  });

  // LOGZ.IO CHANGE START:: Allow swapping the built-in time-range picker
  it('should render a custom picker when provided and drive setTimeRange through its onChange', async () => {
    const CustomPicker: TimeRangePickerComponent = ({ value, onChange }): ReactElement => (
      <button onClick={() => onChange({ pastDuration: '5m' as DurationString })}>
        {`custom-picker:${'pastDuration' in value ? value.pastDuration : 'absolute'}`}
      </button>
    );

    renderWithContext(
      <TimeRangeProviderBasic
        initialRefreshInterval={testDefaultRefreshInterval}
        initialTimeRange={testDefaultTimeRange}
      >
        <ControlsWithCustomPicker picker={CustomPicker} />
      </TimeRangeProviderBasic>,
      undefined
    );

    // The custom picker replaces the built-in selector and receives the current time range value.
    expect(await screen.findByRole('button', { name: 'custom-picker:30m' })).toBeInTheDocument();
    expect(screen.queryByText('Last 30 minutes')).not.toBeInTheDocument();

    // Its onChange is wired to the dashboard time range, so selecting a new value updates the shared context.
    userEvent.click(screen.getByRole('button', { name: 'custom-picker:30m' }));
    expect(await screen.findByRole('button', { name: 'custom-picker:5m' })).toBeInTheDocument();
  });
  // LOGZ.IO CHANGE END:: Allow swapping the built-in time-range picker

  // TODO: add additional tests for absolute time selection, other inputs, form validation, etc.
});
