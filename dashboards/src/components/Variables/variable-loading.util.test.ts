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

// LOGZ.IO ADDITION:: whole file [unidash-perf]

import { VariableOption } from '@perses-dev/plugin-system';
import { isVariableOptionsLoading } from './variable-loading.util';

const OPTIONS: VariableOption[] = [{ value: 'test_value_1', label: 'Test label 1' }];

describe('isVariableOptionsLoading', () => {
  it('should report loading when the first request for the options is in flight', () => {
    expect(isVariableOptionsLoading({ isFetching: true, isPlaceholderData: false, data: undefined })).toBe(true);
  });

  it('should not report loading when a background refresh of the same options is in flight', () => {
    expect(isVariableOptionsLoading({ isFetching: true, isPlaceholderData: false, data: OPTIONS })).toBe(false);
  });

  it('should report loading when the shown options belong to a superseded query', () => {
    expect(isVariableOptionsLoading({ isFetching: true, isPlaceholderData: true, data: OPTIONS })).toBe(true);
  });

  it('should not report loading when no request is in flight', () => {
    expect(isVariableOptionsLoading({ isFetching: false, isPlaceholderData: false, data: OPTIONS })).toBe(false);
    expect(isVariableOptionsLoading({ isFetching: false, isPlaceholderData: false, data: undefined })).toBe(false);
  });

  it('should not report loading when the query state is unknown', () => {
    expect(isVariableOptionsLoading({})).toBe(false);
  });
});
