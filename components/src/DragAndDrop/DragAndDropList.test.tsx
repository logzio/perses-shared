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

import { render, screen } from '@testing-library/react';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { DragAndDropElement } from './DragAndDropList';

// LOGZ.IO CHANGE:: covers scoping the drag to the "move" handle [table-column-drag-handle]
jest.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  draggable: jest.fn(() => (): void => undefined),
  dropTargetForElements: jest.fn(() => (): void => undefined),
  monitorForElements: jest.fn(() => (): void => undefined),
}));

const draggableMock = draggable as jest.Mock;

describe('DragAndDropList', () => {
  it('should scope the drag to the aria-label="move" handle when one is present', () => {
    draggableMock.mockClear();
    render(
      <DragAndDropElement data={{ name: 'col-a' }}>
        <button aria-label="move">reorder</button>
        <input aria-label="header" />
      </DragAndDropElement>
    );

    const handle = screen.getByRole('button', { name: 'move' });
    expect(draggableMock).toHaveBeenCalledTimes(1);
    expect(draggableMock.mock.calls[0]?.[0].dragHandle).toBe(handle);
  });

  it('should fall back to dragging the whole element when no move handle is present', () => {
    draggableMock.mockClear();
    render(
      <DragAndDropElement data={{ name: 'col-b' }}>
        <input aria-label="header" />
      </DragAndDropElement>
    );

    expect(draggableMock).toHaveBeenCalledTimes(1);
    expect(draggableMock.mock.calls[0]?.[0].dragHandle).toBeUndefined();
  });
});
