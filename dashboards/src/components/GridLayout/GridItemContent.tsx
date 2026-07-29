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

import { Box, useForkRef } from '@mui/material';
import { useInView } from 'react-intersection-observer';
import { DataQueriesProvider, usePlugin, useSuggestedStepMs } from '@perses-dev/plugin-system';
import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import { PanelDefinition } from '@perses-dev/spec';
import { isPanelGroupItemIdEqual, PanelGroupItemId } from '../../model'; // TODO
import { useEditMode, usePanel, usePanelActions, useViewPanelGroup } from '../../context';
import { usePanelFocusHandlers } from '../../keyboard-shortcuts';
// LOGZ.IO CHANGE START:: Panel-level time range override [APPZ-2474]
import { PanelTimeRangeOverrideProvider } from '../../context/PanelTimeRangeOverride';
// LOGZ.IO CHANGE END:: Panel-level time range override [APPZ-2474]
import { Panel, PanelProps, PanelOptions } from '../Panel';
import { QueryViewerDialog } from '../QueryViewerDialog';

export interface GridItemContentProps {
  panelGroupItemId: PanelGroupItemId;
  width: number; // necessary for determining the suggested step ms
  panelOptions?: PanelOptions;
  // LOGZ.IO CHANGE:: Set on a repeated copy — Grafana only edits the original [APPZ-0000]
  noEditActions?: boolean;
}

/**
 * Resolves the reference to panel content in a GridItemDefinition and renders the panel.
 */
export function GridItemContent(props: GridItemContentProps): ReactElement {
  const { panelGroupItemId, width } = props;
  const panelDefinition = usePanel(panelGroupItemId);

  const {
    spec: { queries = [] },
  } = panelDefinition;

  const { isEditMode } = useEditMode();
  const { openEditPanel, openDeletePanelDialog, duplicatePanel, viewPanel } = usePanelActions(panelGroupItemId);
  const viewPanelGroupItemId = useViewPanelGroup();

  // Panel focus tracking for keyboard shortcuts
  const { onMouseEnter, onMouseLeave } = usePanelFocusHandlers(
    `${panelGroupItemId.panelGroupId}-${panelGroupItemId.panelGroupItemLayoutId}`
  );

  // LOGZ.IO CHANGE START
  const [scrollRoot, setScrollRoot] = useState<Element | null>(null);

  const findScrollRootRef = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    let el: HTMLElement | null = node.parentElement;
    while (el && el !== document.body) {
      const { overflowY } = getComputedStyle(el);
      if (
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        el.scrollHeight > el.clientHeight
      ) {
        setScrollRoot(el);
        return;
      }
      el = el.parentElement;
    }
    setScrollRoot(null);
  }, []);

  const { ref: queryRef, inView: shouldQuery } = useInView({
    threshold: 0,
    initialInView: false,
    triggerOnce: true,
    root: scrollRoot,
    // LOGZ.IO CHANGE:: prefetch further ahead than we render — the query + transform is the expensive
    // part of a panel scrolling into view, so give it a ~1.5-viewport head start over the scroll.
    // Rendering (mounting ECharts) stays at the tighter margin below. [unidash-perf]
    rootMargin: '1600px 0px',
  });

  const { ref: renderRef, inView: shouldRender } = useInView({
    threshold: 0.2,
    initialInView: false,
    // LOGZ.IO CHANGE START:: keep panels mounted once rendered [unidash-perf]
    // Un-mounting panels that scroll past the margin disposed their ECharts instance and re-created
    // it on the way back (~200-300ms main-thread task per panel crossing), making scroll stutter.
    // With the per-query Series Limit bounding chart memory, keeping panels alive is affordable —
    // render lazily on first approach (initial-load benefit stays), then stay mounted.
    triggerOnce: true,
    // LOGZ.IO CHANGE END:: keep panels mounted once rendered [unidash-perf]
    root: scrollRoot,
    rootMargin: '600px 0px',
  });

  const mergedRef = useForkRef(renderRef, queryRef, findScrollRootRef);
  // LOGZ.IO CHANGE END

  const [openQueryViewer, setOpenQueryViewer] = useState(false);

  const viewQueriesHandler = useMemo(() => {
    return isEditMode || !queries?.length
      ? undefined
      : {
          onClick: (): void => {
            setOpenQueryViewer(true);
          },
        };
  }, [isEditMode, queries]);

  const readHandlers = {
    isPanelViewed: isPanelGroupItemIdEqual(viewPanelGroupItemId, panelGroupItemId),
    onViewPanelClick: function (): void {
      if (viewPanelGroupItemId === undefined) {
        viewPanel(panelGroupItemId);
      } else {
        viewPanel(undefined);
      }
    },
  };

  // Provide actions to the panel when in edit mode
  let editHandlers: PanelProps['editHandlers'] = undefined;
  // LOGZ.IO CHANGE:: A repeated copy is derived, so editing/duplicating/deleting it is meaningless —
  // the change would be discarded on the next expansion. Grafana hides the same actions. [APPZ-0000]
  if (isEditMode && !props.noEditActions) {
    editHandlers = {
      onEditPanelClick: openEditPanel,
      onDuplicatePanelClick: duplicatePanel,
      onDeletePanelClick: openDeletePanelDialog,
    };
  }

  return (
    <Box
      ref={mergedRef}
      tabIndex={-1}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      sx={{
        width: '100%',
        height: '100%',
        outline: 'none',
      }}
    >
      {/* LOGZ.IO CHANGE START:: Panel-level time range override (Grafana timeFrom/timeShift) [APPZ-2474]
          The override needs to wrap useSuggestedStepMs + DataQueriesProvider + Panel so that
          the panel's queries pick up the overridden range. We extract the time-dependent body
          into GridItemContentBody so it sits inside the override-aware TimeRangeProvider. Read via
          local cast to avoid declaration-merging on `@perses-dev/spec` PanelSpec — module-level
          augmentation triggered TS to re-derive types globally and broke pre-existing borderline
          inferences in unrelated app-ui test fixtures (e.g. `kind: string` not narrowing to
          `kind: 'Panel'`). Keep the new fields scoped to consumers.
          shouldQuery/shouldRender forwarded from upstream's split lazy-load (#132/#90). */}
      <PanelTimeRangeOverrideProvider spec={panelDefinition.spec as { timeFrom?: string; timeShift?: string }}>
        <GridItemContentBody
          panelDefinition={panelDefinition}
          width={width}
          shouldQuery={shouldQuery}
          shouldRender={shouldRender}
          panelGroupItemId={panelGroupItemId}
          readHandlers={readHandlers}
          editHandlers={editHandlers}
          viewQueriesHandler={viewQueriesHandler}
          panelOptions={props.panelOptions}
        />
      </PanelTimeRangeOverrideProvider>
      {/* LOGZ.IO CHANGE END:: Panel-level time range override [APPZ-2474] */}
      <QueryViewerDialog open={openQueryViewer} queryDefinitions={queries} onClose={() => setOpenQueryViewer(false)} />
    </Box>
  );
}

// LOGZ.IO CHANGE START:: GridItemContentBody — time-range-aware inner half [APPZ-2474]
interface GridItemContentBodyProps {
  panelDefinition: PanelDefinition;
  width: number;
  shouldQuery: boolean;
  shouldRender: boolean;
  panelGroupItemId: PanelGroupItemId;
  readHandlers: PanelProps['readHandlers'];
  editHandlers: PanelProps['editHandlers'];
  viewQueriesHandler: PanelProps['viewQueriesHandler'];
  panelOptions?: PanelOptions;
}

function GridItemContentBody({
  panelDefinition,
  width,
  shouldQuery,
  shouldRender,
  panelGroupItemId,
  readHandlers,
  editHandlers,
  viewQueriesHandler,
  panelOptions,
}: GridItemContentBodyProps): ReactElement {
  // map TimeSeriesQueryDefinition to Definition<UnknownSpec>
  const suggestedStepMs = useSuggestedStepMs(width);

  const { data: plugin } = usePlugin('Panel', panelDefinition.spec.plugin.kind);

  const definitions = useMemo(
    () =>
      (panelDefinition.spec.queries ?? []).map((query) => {
        return {
          kind: query.spec.plugin.kind,
          spec: query.spec.plugin.spec,
          hidden: (query.spec as { hidden?: boolean }).hidden ?? false, // LOGZ.IO CHANGE:: APPZ-955-math-on-queries-formulas
        };
      }),
    [panelDefinition.spec.queries]
  );

  const pluginQueryOptions = useMemo(
    () =>
      typeof plugin?.queryOptions === 'function'
        ? plugin?.queryOptions(panelDefinition.spec.plugin.spec)
        : plugin?.queryOptions,
    [plugin, panelDefinition.spec.plugin.spec]
  );

  return (
    <DataQueriesProvider
      definitions={definitions}
      options={{ suggestedStepMs, ...pluginQueryOptions }}
      queryOptions={{ enabled: shouldQuery }}
    >
      {shouldRender && (
        <Panel
          definition={panelDefinition}
          readHandlers={readHandlers}
          editHandlers={editHandlers}
          viewQueriesHandler={viewQueriesHandler}
          panelOptions={panelOptions}
          panelGroupItemId={panelGroupItemId}
        />
      )}
    </DataQueriesProvider>
  );
}
// LOGZ.IO CHANGE END:: GridItemContentBody [APPZ-2474]
