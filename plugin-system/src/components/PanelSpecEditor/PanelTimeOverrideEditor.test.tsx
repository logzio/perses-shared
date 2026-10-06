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

// LOGZ.IO CHANGE START:: Panel-level "Max data points" and "Instant query"
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';
import { useForm, useWatch, Control, FieldPath } from 'react-hook-form';
import { PanelEditorValues } from '../../model';
import { PanelTimeOverrideEditor } from './PanelTimeOverrideEditor';

const MAX_DATA_POINTS_PATH = 'panelDefinition.spec.maxDataPoints' as unknown as FieldPath<PanelEditorValues>;
const QUERY_MODE_PATH = 'panelDefinition.spec.queryMode' as unknown as FieldPath<PanelEditorValues>;

/** Mirrors what the form holds so a test can read back what the fields committed. */
function CommittedValue({ control }: { control: Control<PanelEditorValues> }): ReactElement {
  const value = useWatch({ control, name: MAX_DATA_POINTS_PATH });
  const queryMode = useWatch({ control, name: QUERY_MODE_PATH });

  return (
    <>
      <output data-testid="committed">{value === undefined ? 'auto' : String(value)}</output>
      <output data-testid="committed-query-mode">{queryMode === undefined ? 'unset' : String(queryMode)}</output>
    </>
  );
}

interface HarnessProps {
  maxDataPoints?: number;
  queryMode?: string;
  panelKind?: string;
}

function Harness({ maxDataPoints, queryMode, panelKind = 'TimeSeriesChart' }: HarnessProps): ReactElement {
  const { control } = useForm<PanelEditorValues>({
    defaultValues: {
      groupId: 0,
      panelDefinition: {
        kind: 'Panel',
        spec: { plugin: { kind: panelKind, spec: {} }, maxDataPoints, queryMode },
      },
    } as unknown as PanelEditorValues,
  });

  return (
    <>
      <PanelTimeOverrideEditor control={control} panelKind={panelKind} />
      <CommittedValue control={control} />
    </>
  );
}

const renderEditor = (maxDataPoints?: number): void => {
  render(<Harness maxDataPoints={maxDataPoints} />);
};

const renderBarEditor = (queryMode?: string): void => {
  render(<Harness panelKind="BarChart" queryMode={queryMode} />);
};

const queryInstantSwitch = (): HTMLElement | null => screen.queryByRole('checkbox', { name: /instant query/i });

const expandSection = (): void => {
  userEvent.click(screen.getByRole('button', { name: 'Expand query options' }));
};

const getMaxDataPointsInput = (): HTMLInputElement =>
  screen.getByRole('spinbutton', { name: /max data points/i }) as HTMLInputElement;

describe('PanelTimeOverrideEditor', () => {
  it('should render max data points with the fields, before the checkboxes', () => {
    renderEditor();
    expandSection();

    const hideOverride = screen.getByRole('checkbox', { name: /hide override badge/i });
    const maxDataPoints = getMaxDataPointsInput();

    // eslint-disable-next-line no-bitwise
    expect(maxDataPoints.compareDocumentPosition(hideOverride) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should start expanded when only max data points is set', () => {
    renderEditor(200);

    expect(getMaxDataPointsInput()).toHaveValue(200);
  });

  it('should commit the typed value on blur', () => {
    renderEditor();
    expandSection();

    userEvent.type(getMaxDataPointsInput(), '300');
    userEvent.tab();

    expect(screen.getByTestId('committed')).toHaveTextContent('300');
  });

  it('should clamp a value above the accepted range', () => {
    renderEditor();
    expandSection();

    userEvent.type(getMaxDataPointsInput(), '5000');
    userEvent.tab();

    expect(screen.getByTestId('committed')).toHaveTextContent('1000');
    expect(getMaxDataPointsInput()).toHaveValue(1000);
  });

  it('should fall back to auto when the field is cleared', () => {
    renderEditor(200);

    userEvent.clear(getMaxDataPointsInput());
    userEvent.tab();

    expect(screen.getByTestId('committed')).toHaveTextContent('auto');
    expect(getMaxDataPointsInput()).toHaveValue(null);
  });

  it('should fall back to auto when the value is not a usable number', () => {
    renderEditor();
    expandSection();

    userEvent.type(getMaxDataPointsInput(), '0');
    userEvent.tab();

    expect(screen.getByTestId('committed')).toHaveTextContent('auto');
  });

  // LOGZ.IO CHANGE START:: Panel-level "Instant query"
  describe('instant query', () => {
    it('should offer the checkbox on a bar chart, after the other controls', () => {
      renderBarEditor();
      expandSection();

      const instantSwitch = queryInstantSwitch();

      expect(instantSwitch).not.toBeNull();
      // eslint-disable-next-line no-bitwise
      expect(
        getMaxDataPointsInput().compareDocumentPosition(instantSwitch!) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it('should not offer the checkbox on a panel kind that does not support it yet', () => {
      renderEditor();
      expandSection();

      expect(queryInstantSwitch()).toBeNull();
    });

    it('should start expanded and checked when the panel already queries instant', () => {
      renderBarEditor('instant');

      expect(queryInstantSwitch()).toBeChecked();
    });

    it('should commit instant when checked', () => {
      renderBarEditor();
      expandSection();

      userEvent.click(queryInstantSwitch()!);

      expect(screen.getByTestId('committed-query-mode')).toHaveTextContent('instant');
    });

    it('should only show help when the help icon is clicked, not toggle the box', () => {
      renderBarEditor();
      expandSection();

      userEvent.click(screen.getByLabelText(/about instant query/i));

      expect(queryInstantSwitch()).not.toBeChecked();
      expect(screen.getByTestId('committed-query-mode')).toHaveTextContent('unset');
    });

    it('should clear the setting when unchecked, leaving the panel plugin to decide', () => {
      renderBarEditor('instant');

      userEvent.click(queryInstantSwitch()!);

      expect(screen.getByTestId('committed-query-mode')).toHaveTextContent('unset');
    });
  });
  // LOGZ.IO CHANGE END:: Panel-level "Instant query"
});
// LOGZ.IO CHANGE END:: Panel-level "Max data points"
