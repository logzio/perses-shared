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

import { Collapse, useTheme } from '@mui/material';
import { PanelGroupId } from '@perses-dev/spec';
import { PanelOptions, useViewPanelGroup } from '@perses-dev/dashboards';
import { ComponentProps, ReactElement, useEffect, useMemo, useState } from 'react';
import { Layout, Layouts, Responsive, WidthProvider } from 'react-grid-layout';
import { ErrorAlert, ErrorBoundary } from '@perses-dev/components';
// LOGZ.IO CHANGE:: Item-level repeat scopes each instance to one variable value [APPZ-0000]
import { useVariableValues, VariableContext } from '@perses-dev/plugin-system';
// LOGZ.IO CHANGE:: Item-level repeat expands over the dashboard's values, not the enclosing row's [APPZ-0000]
import { useDashboardVariableValues } from '../../context';
import { GRID_LAYOUT_COLS, GRID_LAYOUT_SMALL_BREAKPOINT } from '../../constants';
import { isRepeatBindingEqual, PanelGroupDefinition, RepeatVariableBinding } from '../../model';
import { GridContainer } from './GridContainer';
import { GridItemContent } from './GridItemContent';
import { GridTitle } from './GridTitle';
// LOGZ.IO CHANGE:: Item-level repeat [APPZ-0000]
import { expandRepeatedItemLayouts, isRepeatInstanceId, RepeatedItemLayout } from './repeat-item-layouts';

const DEFAULT_MARGIN = 10;
const ROW_HEIGHT = 30;

// LOGZ.IO CHANGE:: `static` pins derived repeat instances in place [APPZ-0000]
type RowItemLayout = RepeatedItemLayout & { static?: boolean };

export interface RowProps {
  panelGroupId: PanelGroupId;
  groupDefinition: PanelGroupDefinition;
  gridColWidth: number;
  panelFullHeight?: number;
  panelOptions?: PanelOptions;
  isEditMode?: boolean;
  onLayoutChange?: (currentLayout: Layout[], allLayouts: Layouts) => void;
  onWidthChange?: (
    containerWidth: number,
    margin: [number, number],
    cols: number,
    containerPadding: [number, number]
  ) => void;
  repeatVariable?: [string, string];
  /**
   * LOGZ.IO CHANGE:: True when this row is a repeated copy rather than the original [APPZ-0000]
   * Grafana offers row and panel actions on the original only, so the copies render read-only.
   */
  isRepeatClone?: boolean;
}

export function Row({
  panelGroupId,
  groupDefinition,
  gridColWidth,
  panelFullHeight,
  panelOptions,
  isEditMode = false,
  onLayoutChange,
  onWidthChange,
  repeatVariable,
  isRepeatClone = false,
}: RowProps): ReactElement {
  const ResponsiveGridLayout = useMemo(() => WidthProvider(Responsive), []);
  const theme = useTheme();
  const viewPanelItemId = useViewPanelGroup();

  const [isOpen, setIsOpen] = useState(!groupDefinition.isCollapsed);

  const hasViewPanel =
    viewPanelItemId?.panelGroupId === panelGroupId &&
    // Check for repeatVariable panels
    viewPanelItemId.repeatVariable?.[0] === repeatVariable?.[0] &&
    viewPanelItemId.repeatVariable?.[1] === repeatVariable?.[1];
  const itemLayoutViewed = viewPanelItemId?.panelGroupItemLayoutId;

  // If there is a panel in view mode, we should hide the grid if the panel is not in the current group.
  const isGridDisplayed = !viewPanelItemId || hasViewPanel;

  // LOGZ.IO CHANGE START:: Item-level repeat — expand repeating items into one instance per value [APPZ-0000]
  // Resolved against the dashboard's values rather than this row's: when the row repeats over the
  // *same* variable it has already pinned it to a single value, and Grafana still expands the item
  // across all of them. Each instance re-pins the variable for itself in `RepeatScopedGridItem`,
  // so a row repeating over a different variable stays in effect.
  const dashboardVariables = useDashboardVariableValues();

  const { layouts: expandedLayouts, yOffsets } = useMemo(() => {
    const expanded = expandRepeatedItemLayouts(groupDefinition.itemLayouts, dashboardVariables);

    return {
      ...expanded,
      // A derived instance must not be draggable or resizable — its geometry comes from the repeat,
      // so any change would be silently discarded on the next render.
      layouts: expanded.layouts.map<RowItemLayout>((layout) => (layout.binding ? { ...layout, static: true } : layout)),
    };
  }, [groupDefinition.itemLayouts, dashboardVariables]);

  // The viewed panel is addressed by its authored layout id; when that item repeats, the
  // item-level binding picks which instance is being viewed.
  const viewedInstanceId = useMemo(() => {
    if (!itemLayoutViewed) return undefined;

    return expandedLayouts.find(
      (layout) =>
        layout.sourceLayoutId === itemLayoutViewed &&
        isRepeatBindingEqual(layout.binding, viewPanelItemId?.itemRepeatVariable)
    )?.i;
  }, [expandedLayouts, itemLayoutViewed, viewPanelItemId?.itemRepeatVariable]);
  // LOGZ.IO CHANGE END:: Item-level repeat [APPZ-0000]

  // TODO: handle it without useEffect
  useEffect(() => {
    if (hasViewPanel) {
      setIsOpen(true);
    }
  }, [hasViewPanel]);

  // Item layout is override if there is a panel in view mode
  const itemLayouts: RowItemLayout[] = useMemo(() => {
    if (viewedInstanceId) {
      return expandedLayouts.map((itemLayout) => {
        if (itemLayout.i === viewedInstanceId) {
          const rowTitleHeight = 40 + 8; // 40 is the height of the row title and 8 is the margin height
          return {
            ...itemLayout,
            h: Math.round(((panelFullHeight ?? window.innerHeight) - rowTitleHeight) / (ROW_HEIGHT + DEFAULT_MARGIN)), // Viewed panel should take the full height remaining
            w: 48,
            x: 0,
            y: 0,
          };
        }
        return itemLayout;
      });
    }
    return expandedLayouts;
  }, [expandedLayouts, viewedInstanceId, panelFullHeight]);

  // LOGZ.IO CHANGE START:: Repeat instance geometry is derived, so it must never be written back [APPZ-0000]
  const handleLayoutChange = (currentLayout: Layout[], allLayouts: Layouts): void => {
    if (!onLayoutChange) return;

    const authored = groupDefinition.itemLayouts;
    const restored: Layouts = {};
    for (const [breakpoint, entries] of Object.entries(allLayouts)) {
      restored[breakpoint] = restoreAuthoredLayouts(entries, authored, yOffsets);
    }

    onLayoutChange(restoreAuthoredLayouts(currentLayout, authored, yOffsets), restored);
  };
  // LOGZ.IO CHANGE END:: Repeat instance geometry [APPZ-0000]

  return (
    <GridContainer
      sx={{
        display: isGridDisplayed ? 'block' : 'none',
        height: itemLayoutViewed ? `${panelFullHeight}px` : 'unset',
        overflow: itemLayoutViewed ? 'hidden' : 'unset',
      }}
    >
      {groupDefinition.title && (
        <GridTitle
          panelGroupId={panelGroupId}
          title={groupDefinition.title}
          collapse={
            groupDefinition.isCollapsed === undefined
              ? undefined
              : { isOpen: isOpen, onToggleOpen: () => setIsOpen((current) => !current) }
          }
          // LOGZ.IO CHANGE:: Only the original row carries the group controls [APPZ-0000]
          noActions={isRepeatClone}
        />
      )}
      <Collapse in={isOpen} unmountOnExit appear={false} data-testid="panel-group-content">
        <ResponsiveGridLayout
          className="layout"
          breakpoints={{ [GRID_LAYOUT_SMALL_BREAKPOINT]: theme.breakpoints.values.sm, xxs: 0 }}
          cols={GRID_LAYOUT_COLS}
          rowHeight={ROW_HEIGHT}
          draggableHandle=".drag-handle"
          resizeHandles={['se']}
          isDraggable={isEditMode && !hasViewPanel}
          isResizable={isEditMode && !hasViewPanel}
          margin={[DEFAULT_MARGIN, DEFAULT_MARGIN]}
          containerPadding={[0, 10]}
          layouts={{ sm: itemLayouts }}
          onLayoutChange={handleLayoutChange}
          onWidthChange={onWidthChange}
          allowOverlap={hasViewPanel} // Enabling overlap when viewing a specific panel because panel in front of the viewed panel will add empty spaces (empty row height)
        >
          {itemLayouts.map(({ i, w, sourceLayoutId, binding, instanceIndex }) => (
            <div
              key={i}
              style={{
                display: viewedInstanceId ? (viewedInstanceId === i ? 'unset' : 'none') : 'unset',
              }}
            >
              <ErrorBoundary FallbackComponent={ErrorAlert}>
                {/* LOGZ.IO CHANGE:: `binding` scopes a repeated instance to a single variable value [APPZ-0000] */}
                <RepeatScopedGridItem
                  binding={binding}
                  panelOptions={panelOptions}
                  panelGroupItemId={{
                    panelGroupId,
                    panelGroupItemLayoutId: sourceLayoutId,
                    repeatVariable,
                    itemRepeatVariable: binding,
                  }}
                  width={calculateGridItemWidth(w, gridColWidth)}
                  // LOGZ.IO CHANGE:: A copied row, or any instance past the first, is not the original [APPZ-0000]
                  noEditActions={isRepeatClone || (instanceIndex !== undefined && instanceIndex > 0)}
                />
              </ErrorBoundary>
            </div>
          ))}
        </ResponsiveGridLayout>
      </Collapse>
    </GridContainer>
  );
}

const calculateGridItemWidth = (w: number, colWidth: number): number => {
  // 0 * Infinity === NaN, which causes problems with resize contraints
  if (!Number.isFinite(w)) return w;
  return Math.round(colWidth * w + Math.max(0, w - 1) * DEFAULT_MARGIN);
};

// LOGZ.IO CHANGE START:: Item-level repeat helpers [APPZ-0000]

/**
 * Map the layout react-grid-layout reports back onto the authored item layouts.
 *
 * Two things have to be undone: instances of a repeating item are derived, so they are dropped and
 * the authored item is kept exactly as-is; and every other item may have been pushed down to make
 * room for a repeat, so that shift is subtracted. This also preserves the repeat fields, which
 * react-grid-layout strips from the layout objects it echoes back.
 */
function restoreAuthoredLayouts(
  reported: Layout[],
  authored: PanelGroupDefinition['itemLayouts'],
  yOffsets: Record<string, number>
): Layout[] {
  const reportedById = new Map(
    reported.filter((entry) => !isRepeatInstanceId(entry.i)).map((entry) => [entry.i, entry])
  );

  return authored.map((item) => {
    const entry = reportedById.get(item.i);
    if (!entry) return item;

    return { ...item, x: entry.x, y: entry.y - (yOffsets[item.i] ?? 0), w: entry.w, h: entry.h };
  });
}

interface RepeatScopedGridItemProps extends ComponentProps<typeof GridItemContent> {
  binding?: RepeatVariableBinding;
}

/**
 * Renders a grid item with the repeat variable pinned to this instance's value, so the panel's
 * queries, title and links all resolve against it. Without a binding it is just `GridItemContent`.
 */
function RepeatScopedGridItem({ binding, ...props }: RepeatScopedGridItemProps): ReactElement {
  const variables = useVariableValues();

  if (!binding) {
    return <GridItemContent {...props} />;
  }

  return (
    <VariableContext.Provider value={{ state: { ...variables, [binding[0]]: { value: binding[1], loading: false } } }}>
      <GridItemContent {...props} />
    </VariableContext.Provider>
  );
}

// LOGZ.IO CHANGE END:: Item-level repeat helpers [APPZ-0000]
