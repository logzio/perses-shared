// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the \"License\");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an \"AS IS\" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* eslint-disable @typescript-eslint/no-empty-function */
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

import { ReactElement, useState, useMemo, ReactNode, useCallback } from 'react';
import { Drawer, ErrorAlert, ErrorBoundary } from '@perses-dev/components';
import { useVariableValues, VariableContext } from '@perses-dev/plugin-system';
import { usePanelEditor, usePanelKey } from '../../context';
import { RepeatablePanelEditorValues, RepeatVariableBinding } from '../../model';
import { PanelEditorForm } from './PanelEditorForm';

/**
 * The Add/Edit panel drawer for editing a panel's options.
 */
export const PanelDrawer = (): ReactElement => {
  const panelEditor = usePanelEditor();
  const panelKey = usePanelKey(panelEditor?.panelGroupItemId);

  // When the user clicks close, start closing but don't call the store yet to keep values stable during animtation
  const [isClosing, setIsClosing] = useState(false);

  // Drawer is open if we have a model and we're not transitioning out
  const isOpen = panelEditor !== undefined && !isClosing;

  const handleSave = useCallback(
    // LOGZ.IO CHANGE:: Carries the grid item's repeat options through to the store [APPZ-0000]
    (values: RepeatablePanelEditorValues) => {
      // This shouldn't happen since we don't render the submit button until we have a model, but check to make TS happy
      if (panelEditor === undefined || values === undefined) {
        throw new Error('Cannot apply changes');
      }
      panelEditor.applyChanges(values);
      setIsClosing(true);
    },
    [panelEditor]
  );

  const handleClose = (): void => {
    setIsClosing(true);
  };

  // Don't call closeDrawer on the store until the Drawer has completely transitioned out and reset close state
  const handleExited = useCallback(() => {
    panelEditor?.close();
    setIsClosing(false);
  }, [panelEditor]);

  // Disables closing on click out. This is a quick-win solution to avoid losing draft changes.
  // -> TODO find a way to enable closing by clicking-out in edit view, with a discard confirmation modal popping up
  const handleClickOut = (): void => {
    /* do nothing */
  };

  const drawer = useMemo(() => {
    return (
      <Drawer
        isOpen={isOpen}
        onClose={handleClickOut}
        slotProps={{ transition: { onExited: handleExited } }}
        data-testid="panel-editor"
      >
        {/* When the drawer is opened, we should have panel editor state (this also ensures the form state gets reset between opens) */}
        {panelEditor && (
          <ErrorBoundary FallbackComponent={ErrorAlert}>
            <PanelEditorForm
              panelKey={panelKey}
              initialAction={panelEditor.mode}
              initialValues={panelEditor.initialValues}
              onSave={handleSave}
              onClose={handleClose}
            />
          </ErrorBoundary>
        )}
      </Drawer>
    );
  }, [handleExited, handleSave, isOpen, panelEditor, panelKey]);

  // If the panel editor is using a repeat variable, we need to wrap the drawer in a VariableContext.Provider
  // LOGZ.IO CHANGE:: A panel can be scoped by a group repeat, an item repeat, or both (nested) [APPZ-0000]
  const repeatBindings = [
    panelEditor?.panelGroupItemId?.repeatVariable,
    panelEditor?.panelGroupItemId?.itemRepeatVariable,
  ].filter((binding): binding is RepeatVariableBinding => binding !== undefined);

  if (repeatBindings.length > 0) {
    return <RepeatVariableWrapper repeatVariables={repeatBindings}>{drawer}</RepeatVariableWrapper>;
  }

  return drawer;
};

// Wraps the drawer in a VariableContext.Provider to provide the repeat variable value
// This is necessary for previewing panels that use repeat variables and query editor
function RepeatVariableWrapper({
  repeatVariables,
  children,
}: {
  repeatVariables: RepeatVariableBinding[];
  children: ReactNode;
}): ReactElement {
  const variables = useVariableValues();

  const state = repeatVariables.reduce(
    (acc, [name, value]) => ({ ...acc, [name]: { value, loading: false } }),
    variables
  );

  return <VariableContext.Provider value={{ state }}>{children}</VariableContext.Provider>;
}
