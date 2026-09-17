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

// LOGZ.IO CHANGE START:: Panel-level "Max data points"
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';
import { useForm, useWatch, Control, FieldPath } from 'react-hook-form';
import { PanelEditorValues } from '../../model';
import { PanelTimeOverrideEditor } from './PanelTimeOverrideEditor';

const MAX_DATA_POINTS_PATH = 'panelDefinition.spec.maxDataPoints' as unknown as FieldPath<PanelEditorValues>;

/** Mirrors what the form holds so a test can read back what the field committed. */
function CommittedValue({ control }: { control: Control<PanelEditorValues> }): ReactElement {
  const value = useWatch({ control, name: MAX_DATA_POINTS_PATH });

  return <output data-testid="committed">{value === undefined ? 'auto' : String(value)}</output>;
}

function Harness({ maxDataPoints }: { maxDataPoints?: number }): ReactElement {
  const { control } = useForm<PanelEditorValues>({
    defaultValues: {
      groupId: 0,
      panelDefinition: {
        kind: 'Panel',
        spec: { plugin: { kind: 'TimeSeriesChart', spec: {} }, maxDataPoints },
      },
    } as unknown as PanelEditorValues,
  });

  return (
    <>
      <PanelTimeOverrideEditor control={control} />
      <CommittedValue control={control} />
    </>
  );
}

const renderEditor = (maxDataPoints?: number): void => {
  render(<Harness maxDataPoints={maxDataPoints} />);
};

const expandSection = (): void => {
  userEvent.click(screen.getByRole('button', { name: 'Expand query options' }));
};

const getMaxDataPointsInput = (): HTMLInputElement =>
  screen.getByRole('spinbutton', { name: /max data points/i }) as HTMLInputElement;

describe('PanelTimeOverrideEditor', () => {
  it('should render max data points after the other override controls', () => {
    renderEditor();
    expandSection();

    const hideOverride = screen.getByRole('checkbox', { name: /hide override badge/i });
    const maxDataPoints = getMaxDataPointsInput();

    // eslint-disable-next-line no-bitwise
    expect(hideOverride.compareDocumentPosition(maxDataPoints) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
});
// LOGZ.IO CHANGE END:: Panel-level "Max data points"
