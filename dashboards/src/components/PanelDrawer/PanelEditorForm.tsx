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

import { ReactElement, useCallback, useEffect, useState } from 'react';
import { Box, Button, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { PanelDefinition } from '@perses-dev/spec';
import {
  DiscardChangesConfirmationDialog,
  ErrorAlert,
  ErrorBoundary,
  getSubmitText,
  getTitleAction,
} from '@perses-dev/components';
import { PluginKindSelect, usePluginEditor, useValidationSchemas } from '@perses-dev/plugin-system';
import { Controller, FormProvider, Resolver, SubmitHandler, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Action } from '@perses-dev/client';
import { useListPanelGroups } from '../../context';
import { PanelEditorProvider } from '../../context/PanelEditorProvider/PanelEditorProvider';
// LOGZ.IO CHANGE:: Item-level (single panel) repeat
import { RepeatablePanelEditorValues } from '../../model';
import { usePanelEditor } from './usePanelEditor';
import { PanelQueriesSharedControls } from './PanelQueriesSharedControls';
// LOGZ.IO CHANGE:: Re-attach fields stripped by Zod validation before save
import { hasUnsavedChanges, restoreValuesStrippedByValidation } from './panel-editor-values';
// LOGZ.IO CHANGE:: Item-level (single panel) repeat
import { RepeatOptionsEditor } from './RepeatOptionsEditor';

export interface PanelEditorFormProps {
  // LOGZ.IO CHANGE:: `Repeatable*` adds the grid item's repeat options
  initialValues: RepeatablePanelEditorValues;
  initialAction: Action;
  panelKey?: string;
  onSave: (values: RepeatablePanelEditorValues) => void;
  onClose: () => void;
}

export function PanelEditorForm(props: PanelEditorFormProps): ReactElement {
  const { initialValues, initialAction, panelKey, onSave, onClose } = props;
  const panelGroups = useListPanelGroups();
  const { panelDefinition, setName, setDescription, setLinks, setQueries, setPlugin, setPanelDefinition } =
    usePanelEditor(initialValues.panelDefinition);
  const { plugin } = panelDefinition.spec;
  const [isDiscardDialogOpened, setDiscardDialogOpened] = useState<boolean>(false);

  const { panelEditorSchema } = useValidationSchemas();
  // LOGZ.IO CHANGE:: The upstream schema knows nothing of `repeat`, so it validates (and strips) the
  // rest exactly as before — `restoreValuesStrippedByValidation` puts it back.
  const form = useForm<RepeatablePanelEditorValues>({
    resolver: zodResolver(panelEditorSchema) as Resolver<RepeatablePanelEditorValues>,
    mode: 'onBlur',
    defaultValues: initialValues,
  });

  // Use common plugin editor logic even though we've split the inputs up in this form
  const pluginEditor = usePluginEditor({
    pluginTypes: ['Panel'],
    value: { selection: { kind: plugin.kind, type: 'Panel' }, spec: plugin.spec },
    onChange: (plugin) => {
      form.setValue('panelDefinition.spec.plugin', { kind: plugin.selection.kind, spec: plugin.spec });
      setPlugin({
        kind: plugin.selection.kind,
        spec: plugin.spec,
      });
    },
    onHideQueryEditorChange: (isHidden) => {
      setQueries(undefined, isHidden);
    },
  });

  const titleAction = getTitleAction(initialAction, true);
  const submitText = getSubmitText(initialAction, true);

  const links = useWatch({ control: form.control, name: 'panelDefinition.spec.links' });
  useEffect(() => {
    setLinks(links);
  }, [setLinks, links]);

  const processForm: SubmitHandler<RepeatablePanelEditorValues> = useCallback(
    (data) => {
      // LOGZ.IO CHANGE START:: Re-attach fields stripped by Zod validation before save
      // Zod strips the Logz.io extension fields (query `hidden`, panel time override) from the
      // validated values — restore them from the raw form values, see restoreValuesStrippedByValidation.
      onSave(restoreValuesStrippedByValidation(data, form.getValues()));
      // LOGZ.IO CHANGE END:: Re-attach fields stripped by Zod validation before save
    },
    [form, onSave]
  );

  // When user click on cancel, several possibilities:
  // - create action: ask for discard approval
  // - update action: ask for discard approval if changed
  // - read action: don´t ask for discard approval
  function handleCancel(): void {
    // LOGZ.IO CHANGE:: comparison moved to `hasUnsavedChanges` so its normalization rules are
    // unit-testable — see the repeat note there [APPZ-302]
    if (hasUnsavedChanges(initialValues, form.getValues())) {
      setDiscardDialogOpened(true);
    } else {
      onClose();
    }
  }

  const handlePanelDefinitionChange = (nextPanelDefStr: string): void => {
    const nextPanelDef: PanelDefinition = JSON.parse(nextPanelDefStr);
    const { kind: pluginKind, spec: pluginSpec } = nextPanelDef.spec.plugin;
    // if panel plugin kind and spec are modified, then need to save current spec
    if (
      panelDefinition.spec.plugin.kind !== pluginKind &&
      JSON.stringify(panelDefinition.spec.plugin.spec) !== JSON.stringify(pluginSpec)
    ) {
      pluginEditor.rememberCurrentSpecState();
    }
    setPanelDefinition(nextPanelDef);
  };

  const watchedName = useWatch({ control: form.control, name: 'panelDefinition.spec.display.name' });
  const watchedDescription = useWatch({ control: form.control, name: 'panelDefinition.spec.display.description' });
  const watchedPluginKind = useWatch({ control: form.control, name: 'panelDefinition.spec.plugin.kind' });

  const handleSubmit = useCallback(() => {
    form.handleSubmit(processForm)();
  }, [form, processForm]);

  return (
    <FormProvider {...form}>
      <PanelEditorProvider>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            padding: (theme) => theme.spacing(1, 2),
            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h2">{titleAction} Panel</Typography>
            {panelKey && <Typography variant="subtitle1">(ID: {panelKey})</Typography>}
          </Stack>
          <Stack direction="row" spacing={1} marginLeft="auto">
            <Button variant="contained" disabled={!form.formState.isValid} onClick={handleSubmit}>
              {submitText}
            </Button>
            <Button color="secondary" variant="outlined" onClick={handleCancel}>
              Cancel
            </Button>
          </Stack>
        </Box>
        <Box id={panelEditorFormId} sx={{ flex: 1, overflowY: 'scroll', padding: (theme) => theme.spacing(2) }}>
          <Grid container spacing={2}>
            <Grid item xs={8}>
              <Controller
                control={form.control}
                name="panelDefinition.spec.display.name"
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Name"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    value={watchedName ?? ''}
                    onChange={(event) => {
                      field.onChange(event);
                      setName(event.target.value);
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                control={form.control}
                name="groupId"
                render={({ field, fieldState }) => (
                  <TextField
                    select
                    {...field}
                    required
                    fullWidth
                    label="Panel group" // LOGZ.IO CHANGE END:: Micro copy changes [APPZ-260]
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    onChange={(event) => {
                      field.onChange(event);
                    }}
                  >
                    {panelGroups.map((panelGroup, index) => (
                      <MenuItem key={panelGroup.id} value={panelGroup.id}>
                        {panelGroup.title ?? `Group ${index + 1}`}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={8}>
              <Controller
                control={form.control}
                name="panelDefinition.spec.display.description"
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Description"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    value={watchedDescription ?? ''}
                    onChange={(event) => {
                      field.onChange(event);
                      setDescription(event.target.value);
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                control={form.control}
                name="panelDefinition.spec.plugin.kind"
                render={({ field, fieldState }) => (
                  <PluginKindSelect
                    {...field}
                    pluginTypes={['Panel']}
                    required
                    fullWidth
                    label="Visualization type" // LOGZ.IO CHANGE END:: Micro copy changes [APPZ-260]
                    disabled={pluginEditor.isLoading}
                    error={!!pluginEditor.error || !!fieldState.error}
                    helperText={pluginEditor.error?.message ?? fieldState.error?.message}
                    value={{ type: 'Panel', kind: watchedPluginKind }}
                    onChange={(event) => {
                      field.onChange(event.kind);
                      pluginEditor.onSelectionChange(event);
                    }}
                  />
                )}
              />
            </Grid>

            {/* LOGZ.IO CHANGE:: Repeat is a layout value, so it sits with "Panel group" rather than in a
                per-plugin options tab — those exist for only some panel types */}
            <RepeatOptionsEditor control={form.control} />

            <ErrorBoundary FallbackComponent={ErrorAlert}>
              <PanelQueriesSharedControls
                control={form.control}
                plugin={plugin}
                panelDefinition={panelDefinition}
                onQueriesChange={(q) => setQueries(q)}
                onPluginSpecChange={(spec) => {
                  pluginEditor.onSpecChange(spec);
                }}
                onJSONChange={handlePanelDefinitionChange}
              />
            </ErrorBoundary>
          </Grid>
        </Box>
        <DiscardChangesConfirmationDialog
          description="You have unsaved changes in this panel. Are you sure you want to discard them? This action can’t be undone." // LOGZ.IO CHANGE START:: Micro copy changes [APPZ-260]
          isOpen={isDiscardDialogOpened}
          onCancel={() => {
            setDiscardDialogOpened(false);
          }}
          onDiscardChanges={() => {
            setDiscardDialogOpened(false);
            onClose();
          }}
        />
      </PanelEditorProvider>
    </FormProvider>
  );
}

/**
 * The `id` attribute added to the `PanelEditorForm` component, allowing submit buttons to live outside the form.
 */
export const panelEditorFormId = 'panel-editor-form';
