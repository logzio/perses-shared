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

import { renderHook, RenderHookResult } from '@testing-library/react';
import { useGridQueryWidth } from './use-grid-query-width';

interface HookProps {
  width: number;
  isPanelViewed: boolean;
}

const renderQueryWidth = (initialProps: HookProps): RenderHookResult<number, HookProps> =>
  renderHook(({ width, isPanelViewed }: HookProps) => useGridQueryWidth(width, isPanelViewed), { initialProps });

describe('useGridQueryWidth', () => {
  it('should follow the width when the panel is not in view mode', () => {
    const { result, rerender } = renderQueryWidth({ width: 600, isPanelViewed: false });

    rerender({ width: 700, isPanelViewed: false });

    expect(result.current).toBe(700);
  });

  it('should keep the grid width when the panel is in view mode', () => {
    const { result, rerender } = renderQueryWidth({ width: 600, isPanelViewed: false });

    rerender({ width: 2410, isPanelViewed: true });

    expect(result.current).toBe(600);
  });

  it('should ignore a width change when the panel is still in view mode', () => {
    const { result, rerender } = renderQueryWidth({ width: 600, isPanelViewed: false });

    rerender({ width: 2410, isPanelViewed: true });
    // The page lost its scroll bar, so the grid became wider.
    rerender({ width: 2425, isPanelViewed: true });

    expect(result.current).toBe(600);
  });

  it('should follow the width again when the panel leaves view mode', () => {
    const { result, rerender } = renderQueryWidth({ width: 600, isPanelViewed: false });

    rerender({ width: 2410, isPanelViewed: true });
    rerender({ width: 650, isPanelViewed: false });

    expect(result.current).toBe(650);
  });

  it('should use the first width when the panel opens directly in view mode', () => {
    const { result } = renderQueryWidth({ width: 2410, isPanelViewed: true });

    expect(result.current).toBe(2410);
  });
});

// LOGZ.IO CHANGE END:: A viewed panel keeps the query width it had in the grid
