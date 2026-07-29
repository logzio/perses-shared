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

// LOGZ.IO CHANGE START:: Item-level (single panel) repeat, mirroring Grafana's panel repeat [APPZ-0000]

import { ReactElement } from 'react';
import { Grid, MenuItem, TextField, Typography } from '@mui/material';
import { Control, Controller, useWatch } from 'react-hook-form';
import { useVariableDefinitions } from '../../context';
import { RepeatablePanelEditorValues } from '../../model';

/** Submitted by the "None" option — `applyItemRepeat` reads it as "no repeat". */
const NO_REPEAT = '';

/** The choices Grafana offers for max-per-row. */
const MAX_PER_ROW_OPTIONS = [2, 3, 4, 6, 8, 12];

export interface RepeatOptionsEditorProps {
  control: Control<RepeatablePanelEditorValues>;
}

/**
 * Editor for repeating a single panel once per value of a dashboard variable, the panel-level
 * counterpart to repeating a whole panel group. Field names and choices mirror Grafana's "Repeat
 * options" section so a converted dashboard reads the same in both products.
 *
 * Direction and max-per-row appear only once a variable is chosen, since neither means anything on
 * its own — same as Grafana.
 */
export function RepeatOptionsEditor({ control }: RepeatOptionsEditorProps): ReactElement {
  const variableDefinitions = useVariableDefinitions();

  const repeatVariable = useWatch({ control, name: 'repeat.repeatVariable' });
  const repeatDirection = useWatch({ control, name: 'repeat.repeatDirection' });
  const maxPerRow = useWatch({ control, name: 'repeat.maxPerRow' });

  const isRepeating = !!repeatVariable;
  // Grafana treats an unset direction as horizontal, and only then is max-per-row meaningful.
  const isHorizontal = repeatDirection !== 'v';

  return (
    <>
      <Grid item xs={12}>
        <Typography variant="h4">Repeat options</Typography>
      </Grid>
      <Grid item xs={4}>
        <Controller
          control={control}
          name="repeat.repeatVariable"
          render={({ field }) => (
            <TextField
              {...field}
              select
              fullWidth
              label="Repeat by variable"
              helperText="Renders one copy of this panel per value of the variable"
              value={repeatVariable ?? NO_REPEAT}
            >
              <MenuItem value={NO_REPEAT}>None</MenuItem>
              {variableDefinitions.map((definition) => (
                <MenuItem key={definition.spec.name} value={definition.spec.name}>
                  {definition.spec.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </Grid>
      {isRepeating && (
        <Grid item xs={4}>
          <Controller
            control={control}
            name="repeat.repeatDirection"
            render={({ field }) => (
              <TextField {...field} select fullWidth label="Repeat direction" value={repeatDirection ?? 'h'}>
                <MenuItem value="h">Horizontal</MenuItem>
                <MenuItem value="v">Vertical</MenuItem>
              </TextField>
            )}
          />
        </Grid>
      )}
      {isRepeating && isHorizontal && (
        <Grid item xs={4}>
          <Controller
            control={control}
            name="repeat.maxPerRow"
            render={({ field }) => (
              <TextField
                {...field}
                select
                fullWidth
                label="Max per row"
                value={maxPerRow ?? ''}
                onChange={(event) => field.onChange(event.target.value === '' ? undefined : Number(event.target.value))}
              >
                {MAX_PER_ROW_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>
      )}
    </>
  );
}

// LOGZ.IO CHANGE END:: Item-level (single panel) repeat [APPZ-0000]
