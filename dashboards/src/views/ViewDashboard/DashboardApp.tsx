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

import { ReactElement, ReactNode, useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import {
  ChartsProvider,
  ErrorAlert,
  ErrorBoundary,
  useChartsTheme,
  useChartsContext,
  TimeRangePickerComponent, // LOGZ.IO CHANGE:: pluggable time-range picker
} from '@perses-dev/components';
import { useDatasourceStore } from '@perses-dev/plugin-system';
import { DashboardSpec } from '@perses-dev/spec';
import { DashboardResource } from '@perses-dev/client';
import {
  PanelDrawer,
  Dashboard,
  useDashboardShortcuts,
  PanelGroupDialog,
  DeletePanelGroupDialog,
  DashboardDiscardChangesConfirmationDialog,
  DashboardToolbar,
  DeletePanelDialog,
  EmptyDashboardProps,
  EditJsonDialog,
  SaveChangesConfirmationDialog,
  LeaveDialog,
} from '../../components';
import { OnSaveDashboard, useDashboard, useDiscardChangesConfirmationDialog, useEditMode } from '../../context';
import { PanelFocusProvider } from '../../keyboard-shortcuts';

export interface DashboardAppProps {
  dashboardResource: DashboardResource;
  emptyDashboardProps?: Partial<EmptyDashboardProps>;
  isReadonly: boolean;
  isVariableEnabled: boolean;
  isAnnotationEnabled: boolean;
  isDatasourceEnabled: boolean;
  disableShortcuts?: boolean;
  isCreating?: boolean;
  isInitialVariableSticky?: boolean;
  // If true, browser confirmation dialog will be shown when navigating away with unsaved changes (closing tab, ...).
  isLeavingConfirmDialogEnabled?: boolean;
  dashboardTitleComponent?: ReactNode;
  userPreferenceTimezone?: DashboardSpec['timezone'];
  onSave?: OnSaveDashboard;
  onDiscard?: (name: string, spec: DashboardSpec) => void;
  toolbarAddonComponent?: ReactNode; // LOGZ.IO CHANGE:: Support AdHoc filters
  dashboardControlsComponent?: JSX.Element; // LOGZ.IO CHANGE:: Add support for dashboardControlsComponent
  timeRangePicker?: TimeRangePickerComponent; // LOGZ.IO CHANGE:: Allow swapping the built-in time-range picker
  onDashboardChange?: (dashboard: DashboardResource) => void; // LOGZ.IO CHANGE:: Alert users when trying to navigate out of dashboard in edit mode that has changes
}

export const DashboardApp = (props: DashboardAppProps): ReactElement => {
  return (
    <PanelFocusProvider>
      <DashboardAppContent {...props} />
    </PanelFocusProvider>
  );
};

const DashboardAppContent = (props: DashboardAppProps): ReactElement => {
  const {
    dashboardResource,
    emptyDashboardProps,
    isReadonly,
    isVariableEnabled,
    isAnnotationEnabled,
    isDatasourceEnabled,
    disableShortcuts,
    isCreating,
    isInitialVariableSticky,
    isLeavingConfirmDialogEnabled,
    dashboardTitleComponent,
    userPreferenceTimezone,
    onSave,
    onDiscard,
    dashboardControlsComponent, // LOGZ.IO CHANGE:: Add support for dashboardControlsComponent
    toolbarAddonComponent, // LOGZ.IO CHANGE:: Support AdHoc filters
    timeRangePicker, // LOGZ.IO CHANGE:: Allow swapping the built-in time-range picker
    onDashboardChange, // LOGZ.IO CHANGE:: Alert users when trying to navigate out of dashboard in edit mode that has changes
  } = props;

  const chartsTheme = useChartsTheme();
  const parentChartsContext = useChartsContext(); // LOGZ.IO CHANGE:: Custom Drilldown preview

  const { isEditMode, setEditMode } = useEditMode();

  const { dashboard, setDashboard } = useDashboard();
  const [originalDashboard, setOriginalDashboard] = useState<DashboardResource | undefined>(undefined);

  const { setSavedDatasources } = useDatasourceStore();

  const { openDiscardChangesConfirmationDialog, closeDiscardChangesConfirmationDialog } =
    useDiscardChangesConfirmationDialog();

  const handleDiscardChanges = (): void => {
    // Reset to the original spec and exit edit mode
    if (originalDashboard) {
      setDashboard(originalDashboard);
    }
    setEditMode(false);
    closeDiscardChangesConfirmationDialog();
    if (onDiscard) {
      onDiscard(dashboard.metadata.name, dashboard.spec);
    }
  };

  // LOGZ.IO CHANGE START:: Alert users when trying to navigate out of dashboard in edit mode that has changes
  useEffect(() => {
    onDashboardChange?.(dashboard as unknown as DashboardResource);
  }, [dashboard, onDashboardChange, originalDashboard]);
  // LOGZ.IO CHANGE END:: Alert users when trying to navigate out of dashboard in edit mode that has changes

  const onEditButtonClick = (): void => {
    setEditMode(true);
    setOriginalDashboard(dashboard);
    setSavedDatasources(dashboard.spec.datasources ?? {});
  };

  const onCancelButtonClick = (): void => {
    // check if dashboard has been modified
    if (JSON.stringify(dashboard) === JSON.stringify(originalDashboard)) {
      setEditMode(false);
    } else {
      openDiscardChangesConfirmationDialog({
        onDiscardChanges: () => {
          handleDiscardChanges();
        },
        onCancel: () => {
          closeDiscardChangesConfirmationDialog();
        },
      });
    }
  };

  useDashboardShortcuts({
    onSave,
    isReadonly,
    onEditButtonClick,
    onCancelButtonClick,
    disabled: disableShortcuts,
  });

  const toolBarTimezone = useMemo((): string => {
    return dashboardResource.spec.timezone || userPreferenceTimezone || 'local';
  }, [dashboardResource.spec, userPreferenceTimezone]);

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <DashboardToolbar
        dashboardName={dashboardResource.metadata.name}
        timezone={toolBarTimezone}
        dashboardTitleComponent={dashboardTitleComponent}
        initialVariableIsSticky={isInitialVariableSticky}
        onSave={onSave}
        isReadonly={isReadonly}
        isVariableEnabled={isVariableEnabled}
        isAnnotationEnabled={isAnnotationEnabled}
        isDatasourceEnabled={isDatasourceEnabled}
        onEditButtonClick={onEditButtonClick}
        onCancelButtonClick={onCancelButtonClick}
        dashboardControlsComponent={dashboardControlsComponent}
        toolbarAddonComponent={toolbarAddonComponent} // LOGZ.IO CHANGE:: Support AdHoc filters
        timeRangePicker={timeRangePicker} // LOGZ.IO CHANGE:: Allow swapping the built-in time-range picker
      />
      <Box
        sx={{
          flexGrow: 1,
          overflowX: 'hidden',
          overflowY: 'auto',
          paddingTop: 1,
          paddingX: 2,
        }}
      >
        <ErrorBoundary FallbackComponent={ErrorAlert}>
          <Dashboard
            emptyDashboardProps={{
              onEditButtonClick,
              ...emptyDashboardProps,
            }}
          />
        </ErrorBoundary>
        <ChartsProvider
          chartsTheme={chartsTheme}
          enableSyncGrouping={false}
          enablePinning={true} // LOGZ.IO CHANGE:: Custom Drilldown preview
          pointActions={parentChartsContext.pointActions || []} // LOGZ.IO CHANGE:: Custom Drilldown preview
        >
          <PanelDrawer />
        </ChartsProvider>
        <PanelGroupDialog />
        <DeletePanelGroupDialog />
        <DeletePanelDialog />
        <DashboardDiscardChangesConfirmationDialog />
        <EditJsonDialog isReadonly={!isEditMode} disableMetadataEdition={!isCreating} />
        <SaveChangesConfirmationDialog />
        {isLeavingConfirmDialogEnabled && isEditMode && (
          <LeaveDialog original={originalDashboard} current={dashboard} />
        )}
      </Box>
    </Box>
  );
};
