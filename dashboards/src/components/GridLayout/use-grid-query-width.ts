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

// LOGZ.IO CHANGE START:: A viewed panel keeps the query width it had in the grid

import { useState } from 'react';

/**
 * Returns the width that sizes the queries of a panel.
 *
 * The width sets `suggestedStepMs`, and `suggestedStepMs` is a part of each time-series query key. View mode
 * makes the panel wider, so the new key sends the queries again for the data that the panel already shows.
 * While the panel is in view mode, this hook keeps the last width that the panel had in the grid. It ignores
 * all width changes in view mode, for example when the page loses its scroll bar.
 */
export function useGridQueryWidth(width: number, isPanelViewed: boolean): number {
  const [gridWidth, setGridWidth] = useState(width);

  // A state update during render is the React pattern for a value from an earlier render.
  if (!isPanelViewed && width !== gridWidth) {
    setGridWidth(width);
  }

  return isPanelViewed ? gridWidth : width;
}

// LOGZ.IO CHANGE END:: A viewed panel keeps the query width it had in the grid
