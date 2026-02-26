// LOGZ.IO CHANGE START:: PanelSpecChangeProvider for bidirectional panel-settings sync [APPZ-1695]
import { createContext, useContext } from 'react';
import { UnknownSpec } from '@perses-dev/core';

const PanelSpecChangeContext = createContext<((spec: UnknownSpec) => void) | undefined>(undefined);

export const PanelSpecChangeProvider = PanelSpecChangeContext.Provider;

export const usePanelSpecChange = (): ((spec: UnknownSpec) => void) | undefined => useContext(PanelSpecChangeContext);
// LOGZ.IO CHANGE END:: PanelSpecChangeProvider for bidirectional panel-settings sync [APPZ-1695]
