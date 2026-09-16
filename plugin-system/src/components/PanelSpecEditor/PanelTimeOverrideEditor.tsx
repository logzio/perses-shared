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

// LOGZ.IO CHANGE START:: Panel-level time range override editor (Grafana parity) [APPZ-2474]
// Renders the react-hook-form-bound inputs for the panel-level "Relative time" / "Time shift" /
// "Hide override" / "Max data points" fields. Lives in plugin-system because it's used
// by `PanelSpecEditor` (also plugin-system); only depends on react-hook-form + MUI
// + plugin-system's own `PanelEditorValues` type (moved out of `@perses-dev/spec` in 0.54.0).
//
// Field paths are cast to `any` because the `PanelSpec` interface in `@perses-dev/spec`
// doesn't declare these fields (we deliberately avoided module-augmenting it — see the
// commit body on the runtime override provider for why). The runtime path resolution
// in react-hook-form is string-based and works regardless of the static types.
import {
  Stack,
  TextField,
  FormControlLabel,
  Checkbox,
  Typography,
  Box,
  Collapse,
  IconButton,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import { Control, Controller, FieldPath, useWatch } from 'react-hook-form';
import { ReactElement, Ref, useEffect, useState } from 'react';
import ChevronDownIcon from 'mdi-material-ui/ChevronDown';
import ChevronRightIcon from 'mdi-material-ui/ChevronRight';
import InformationOutlineIcon from 'mdi-material-ui/InformationOutline';
import { MAX_MAX_DATA_POINTS, MIN_MAX_DATA_POINTS, PanelEditorValues, parseMaxDataPointsInput } from '../../model';

export interface PanelTimeOverrideEditorProps {
  control: Control<PanelEditorValues>;
}

const TIME_FROM_PATH = 'panelDefinition.spec.timeFrom' as unknown as FieldPath<PanelEditorValues>;
const TIME_SHIFT_PATH = 'panelDefinition.spec.timeShift' as unknown as FieldPath<PanelEditorValues>;
const HIDE_OVERRIDE_PATH = 'panelDefinition.spec.hideTimeOverride' as unknown as FieldPath<PanelEditorValues>;
const MAX_DATA_POINTS_PATH = 'panelDefinition.spec.maxDataPoints' as unknown as FieldPath<PanelEditorValues>;

const SMALL_INPUT_HEIGHT = 40;

const MAX_DATA_POINTS_HELP =
  `The maximum data points per series (${MIN_MAX_DATA_POINTS}–${MAX_MAX_DATA_POINTS}). The query interval becomes ` +
  `the panel's time range divided by this number, rounded to the nearest clean interval, so the result is close to ` +
  `the number asked for rather than exactly it. A query's own interval setting still wins where it is coarser. ` +
  `Leave empty to derive the interval from the panel's width.`;

export function PanelTimeOverrideEditor({ control }: PanelTimeOverrideEditorProps): ReactElement {
  // Watch the section's fields so we can decide whether to start expanded (any
  // value already set) or collapsed (the common case for new panels). We only read the
  // values once at mount via the lazy `useState` initializer — toggling the section
  // shouldn't depend on the live value, otherwise typing would auto-collapse the
  // section the moment the user clears the field.
  const timeFrom = useWatch({ control, name: TIME_FROM_PATH });
  const timeShift = useWatch({ control, name: TIME_SHIFT_PATH });
  const hideOverride = useWatch({ control, name: HIDE_OVERRIDE_PATH });
  const maxDataPoints = useWatch({ control, name: MAX_DATA_POINTS_PATH });
  const [isOpen, setIsOpen] = useState(() => Boolean(timeFrom || timeShift || hideOverride || maxDataPoints));

  return (
    <Box sx={{ pb: 2, borderBottom: 1, borderColor: (theme) => theme.palette.divider }}>
      <Stack
        direction="row"
        alignItems="center"
        sx={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <IconButton size="small" aria-label={isOpen ? 'Collapse query options' : 'Expand query options'}>
          {isOpen ? <ChevronDownIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
        <Typography variant="overline" component="h4">
          Query options
        </Typography>
      </Stack>
      <Collapse in={isOpen} unmountOnExit>
        <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mt: 1, ml: 4 }}>
          <Controller
            control={control}
            name={TIME_FROM_PATH}
            render={({ field }) => (
              <TextField
                size="small"
                label="Relative time"
                placeholder="e.g. 14d"
                helperText="Override dashboard time range"
                value={(field.value as string | undefined) ?? ''}
                onChange={(e) => field.onChange(e.target.value || undefined)}
                onBlur={field.onBlur}
                inputRef={field.ref}
                sx={{ width: 240 }}
              />
            )}
          />
          <Controller
            control={control}
            name={TIME_SHIFT_PATH}
            render={({ field }) => (
              <TextField
                size="small"
                label="Time shift"
                placeholder="e.g. 1d"
                helperText="Shift both ends back by this duration"
                value={(field.value as string | undefined) ?? ''}
                onChange={(e) => field.onChange(e.target.value || undefined)}
                onBlur={field.onBlur}
                inputRef={field.ref}
                sx={{ width: 240 }}
              />
            )}
          />
          <Controller
            control={control}
            name={HIDE_OVERRIDE_PATH}
            render={({ field }) => (
              <FormControlLabel
                // Height of a `size="small"` input, so the checkbox centers on the input boxes
                // rather than on the fields, whose helper text makes them taller.
                sx={{ height: SMALL_INPUT_HEIGHT }}
                control={
                  <Checkbox
                    size="small"
                    checked={Boolean(field.value)}
                    onChange={(e) => field.onChange(e.target.checked || undefined)}
                    inputRef={field.ref}
                  />
                }
                label="Hide override badge"
              />
            )}
          />
          <Controller
            control={control}
            name={MAX_DATA_POINTS_PATH}
            render={({ field }) => (
              <MaxDataPointsField
                value={field.value as number | undefined}
                onChange={field.onChange}
                inputRef={field.ref}
              />
            )}
          />
        </Stack>
      </Collapse>
    </Box>
  );
}

interface MaxDataPointsFieldProps {
  value?: number;
  onChange: (value?: number) => void;
  inputRef: Ref<HTMLInputElement>;
}

/**
 * Number input that only commits a valid value. The typed text is kept locally so a half-finished
 * number ("10" on the way to "100") doesn't re-run the panel's queries on every keystroke, and
 * blur is what clamps it into range and hands it to the form — the same deal the Series Limit
 * field offers in the Prometheus query editor.
 */
function MaxDataPointsField({ value, onChange, inputRef }: MaxDataPointsFieldProps): ReactElement {
  const [draft, setDraft] = useState(() => value?.toString() ?? '');

  // Follows the form when the value changes elsewhere (the JSON tab, switching panels).
  useEffect(() => {
    setDraft(value?.toString() ?? '');
  }, [value]);

  const handleBlur = (): void => {
    const parsed = parseMaxDataPointsInput(draft);

    setDraft(parsed?.toString() ?? '');
    onChange(parsed);
  };

  return (
    <TextField
      size="small"
      type="number"
      label="Max data points"
      placeholder="Auto"
      helperText="Interval = time range / max data points"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      inputRef={inputRef}
      sx={{ width: 240 }}
      slotProps={{
        htmlInput: { min: MIN_MAX_DATA_POINTS, max: MAX_MAX_DATA_POINTS, step: 1 },
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={MAX_DATA_POINTS_HELP}>
                <InformationOutlineIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'help' }} />
              </Tooltip>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
// LOGZ.IO CHANGE END:: Panel-level time range override editor [APPZ-2474]
