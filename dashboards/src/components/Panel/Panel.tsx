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

import { Card, CardContent, CardProps } from '@mui/material';
import {
  ErrorAlert,
  ErrorBoundary,
  ItemActionsProvider,
  SelectionProvider,
  combineSx,
  useId,
} from '@perses-dev/components';
import { PanelDefinition } from '@perses-dev/spec';
import { ActionOptions, useDataQueriesContext, usePlugin } from '@perses-dev/plugin-system';
import { ComponentType, ReactNode, memo, useMemo, useState } from 'react';
import useResizeObserver from 'use-resize-observer';
import { PanelGroupItemId } from '../../model';
import { PanelContent } from './PanelContent';
import { PanelHeader, PanelHeaderProps } from './PanelHeader';

export interface PanelProps extends CardProps<'section'> {
  definition: PanelDefinition;
  readHandlers?: PanelHeaderProps['readHandlers'];
  editHandlers?: PanelHeaderProps['editHandlers'];
  panelOptions?: PanelOptions;
  panelGroupItemId?: PanelGroupItemId;
  viewQueriesHandler?: PanelHeaderProps['viewQueriesHandler'];
}

export type PanelOptions = {
  /**
   * Allow you to hide the panel header if desired.
   * This can be useful in embedded mode for example.
   */
  hideHeader?: boolean;
  /**
   * Whether to show panel icons always, or only when hovering over the panel.
   * Default: if the dashboard is in editing mode or the panel is in fullscreen mode: 'always', otherwise 'hover'
   */
  showIcons?: 'always' | 'hover';
  /**
   * Content to render in right of the panel header. (top right of the panel)
   * It will only be rendered when the panel is in edit mode.
   */
  extra?: (props: PanelExtraProps) => ReactNode;
};

export type PanelExtraProps = {
  /**
   * The PanelDefinition for the panel.
   */
  panelDefinition?: PanelDefinition;
  /**
   * The PanelGroupItemId for the panel.
   */
  panelGroupItemId?: PanelGroupItemId;
};

/**
 * Renders a PanelDefinition's content inside of a Card.
 *
 * Internal structure:
 * <Panel>                  // renders an entire panel, incl. header and action buttons
 *   <PanelContent>         // renders loading, error or panel based on the queries' status
 *     <PanelPluginLoader>  // loads a panel plugin from the plugin registry and renders the PanelComponent with data from props.queryResults
 */
// LOGZ.IO ADDITION:: one empty list for every panel without actions, so the memo below keeps its
// identity and the header does not re-render for a new `[]`. [unidash-perf]
const NO_PLUGIN_ACTIONS: ReactNode[] = [];

export const Panel = memo(function Panel(props: PanelProps) {
  const {
    definition,
    readHandlers,
    editHandlers,
    onMouseEnter,
    onMouseLeave,
    sx,
    panelOptions,
    panelGroupItemId,
    viewQueriesHandler,
    ...others
  } = props;

  // Make sure we have an ID we can use for aria attributes
  const generatedPanelId = useId('Panel');
  const headerId = `${generatedPanelId}-header`;

  const [contentElement, setContentElement] = useState<HTMLElement | null>(null);

  const { width, height } = useResizeObserver({ ref: contentElement });

  const contentDimensions = useMemo(() => {
    if (width === undefined || height === undefined) return undefined;
    return { width, height };
  }, [width, height]);

  const { queryResults } = useDataQueriesContext();

  const panelPropsForActions = useMemo(() => {
    return {
      spec: definition.spec.plugin.spec,
      queryResults: queryResults.map((query) => ({
        definition: query.definition,
        data: query.data,
      })),
      contentDimensions,
      definition,
    };
  }, [definition, contentDimensions, queryResults]);

  // LOGZ.IO CHANGE START:: resolve the plugin's header actions during render [unidash-perf]
  // This used to await `getPlugin` in an effect and keep the rendered elements in state, so every
  // render that changed `queryResults` identity committed twice: once for the render, once for the
  // actions the effect then produced. Between the two the header showed actions built from the
  // previous render's props. The plugin is already in the query cache — `PanelContent` loads it
  // through the same key — so reading it here costs no request.
  const { data: panelPlugin } = usePlugin('Panel', definition.spec.plugin.kind);

  const pluginActions = useMemo((): ReactNode[] => {
    const actions = panelPlugin?.actions;
    if (actions === undefined || actions.length === 0) {
      return NO_PLUGIN_ACTIONS;
    }

    return actions
      .filter((action) => action.location === undefined || action.location === 'header')
      .map((action, index) => {
        // The plugin declares its action components against its own spec type, which this generic
        // panel cannot name; the props are the ones every panel plugin receives.
        const ActionComponent = action.component as ComponentType<typeof panelPropsForActions>;
        return <ActionComponent key={`plugin-action-${index}`} {...panelPropsForActions} />;
      });
  }, [panelPlugin, panelPropsForActions]);
  // LOGZ.IO CHANGE END:: resolve the plugin's header actions during render [unidash-perf]

  const handleMouseEnter: CardProps['onMouseEnter'] = (e) => {
    onMouseEnter?.(e);
  };

  const handleMouseLeave: CardProps['onMouseLeave'] = (e) => {
    onMouseLeave?.(e);
  };

  // default value for showIcons: if the dashboard is in editing mode or the panel is in fullscreen mode: 'always', otherwise 'hover'
  const showIcons = panelOptions?.showIcons ?? (editHandlers || readHandlers?.isPanelViewed ? 'always' : 'hover');
  const itemActionsConfig = definition.spec.plugin.spec?.actions
    ? (definition.spec.plugin.spec.actions as ActionOptions)
    : undefined;
  const itemActionsListConfig =
    itemActionsConfig?.enabled && itemActionsConfig.displayInHeader ? itemActionsConfig.actionsList : [];

  return (
    <SelectionProvider>
      <ItemActionsProvider>
        <Card
          component="section"
          sx={combineSx(
            {
              width: '100%',
              height: '100%',
              display: 'flex',
              flexFlow: 'column nowrap',
              // LOGZ.IO CHANGE START
              ':hover': { '--panel-hover': 'flex' },
              // LOGZ.IO CHANGE END
            },
            sx
          )}
          variant="outlined"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-labelledby={headerId}
          aria-describedby={headerId}
          data-testid="panel"
          {...others}
        >
          {!panelOptions?.hideHeader && (
            <PanelHeader
              extra={panelOptions?.extra?.({ panelDefinition: definition, panelGroupItemId })}
              id={headerId}
              title={definition.spec.display?.name ?? ''}
              description={definition.spec.display?.description}
              queryResults={queryResults}
              readHandlers={readHandlers}
              editHandlers={editHandlers}
              viewQueriesHandler={viewQueriesHandler}
              links={definition.spec.links}
              pluginActions={pluginActions}
              itemActionsListConfig={itemActionsListConfig}
              showIcons={showIcons}
              sx={{ py: '2px', pl: '8px', pr: '2px' }}
              dimension={contentDimensions}
              // LOGZ.IO CHANGE START:: Panel-level time range override [APPZ-2474]
              // Read via local cast to avoid declaration-merging on `@perses-dev/core` —
              // module augmentation triggers TS to re-derive types globally and breaks pre-existing
              // borderline inferences in unrelated app-ui test fixtures (e.g. `kind: string` not
              // narrowing to `kind: 'Panel'`). Keep the new fields scoped to consumers.
              timeFrom={(definition.spec as { timeFrom?: string }).timeFrom}
              timeShift={(definition.spec as { timeShift?: string }).timeShift}
              hideTimeOverride={(definition.spec as { hideTimeOverride?: boolean }).hideTimeOverride}
              // LOGZ.IO CHANGE END:: Panel-level time range override [APPZ-2474]
            />
          )}
          <CardContent
            component="figure"
            sx={{
              position: 'relative',
              overflow: 'hidden',
              flexGrow: 1,
              margin: 0,
              padding: 0,
              // Override MUI default style for last-child
              ':last-child': {
                padding: 0,
              },
            }}
            ref={setContentElement}
          >
            <ErrorBoundary FallbackComponent={ErrorAlert} resetKeys={[definition.spec, queryResults]}>
              <PanelContent
                definition={definition}
                panelPluginKind={definition.spec.plugin.kind}
                spec={definition.spec.plugin.spec}
                contentDimensions={contentDimensions}
                queryResults={queryResults}
              />
            </ErrorBoundary>
          </CardContent>
        </Card>
      </ItemActionsProvider>
    </SelectionProvider>
  );
});
