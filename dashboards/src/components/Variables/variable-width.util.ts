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

// LOGZ.IO CHANGE:: whole file
import { Theme } from '@mui/material';
import { VariableOption } from '@perses-dev/plugin-system';
import { MAX_VARIABLE_WIDTH, MIN_VARIABLE_WIDTH } from '../../constants';

const ARROW_DROPDOWN_WIDTH = 40;
const PADDING_BUFFER = 20;
const DEFAULT_FONT_SIZE_PX = 14;
const FALLBACK_CHAR_WIDTH = 8;
// The widest label is virtually always one of the longest ones, so only those are measured.
// Measuring every option would be wasteful on high cardinality variables.
const MEASURED_OPTIONS_COUNT = 5;

let measurementCanvas: HTMLCanvasElement | null = null;
let measurementContext: CanvasRenderingContext2D | null = null;

function getMeasurementContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') {
    return null;
  }

  if (!measurementCanvas) {
    measurementCanvas = document.createElement('canvas');
    measurementContext = measurementCanvas.getContext('2d');
  }

  return measurementContext;
}

function getTextWidth(text: string, font: string): number {
  const context = getMeasurementContext();

  if (!context) {
    return text.length * FALLBACK_CHAR_WIDTH;
  }

  context.font = font;
  const metrics = context.measureText(text);
  return Math.ceil(metrics.width);
}

/**
 * Builds the canvas font shorthand matching what MUI actually renders inside the input, which is
 * `theme.typography.body1`. Hardcoding a font makes every measurement wrong on themes that pick
 * another one (app-ui renders Inter, the standalone Perses themes render Roboto).
 */
export const getInputFont = (theme: Theme): string => {
  const { fontWeight, fontSize, fontFamily } = theme.typography.body1;
  // Canvas resolves relative units against the detached canvas rather than the document, so rem is converted here.
  const fontSizePx =
    typeof fontSize === 'string' && fontSize.endsWith('rem')
      ? parseFloat(fontSize) * theme.typography.htmlFontSize
      : parseFloat(`${fontSize ?? DEFAULT_FONT_SIZE_PX}`) || DEFAULT_FONT_SIZE_PX;

  return `${fontWeight ?? 400} ${fontSizePx}px ${fontFamily ?? 'sans-serif'}`;
};

/**
 * Width needed to render `value` inside a variable input, clamped between the min and max variable width.
 */
export const getWidthPx = (value: string, kind: 'list' | 'text', font: string): number => {
  const textWidth = getTextWidth(value, font);

  const totalWidth = textWidth + (kind === 'list' ? ARROW_DROPDOWN_WIDTH : 0) + PADDING_BUFFER;

  if (totalWidth < MIN_VARIABLE_WIDTH) {
    return MIN_VARIABLE_WIDTH;
  } else if (totalWidth > MAX_VARIABLE_WIDTH) {
    return MAX_VARIABLE_WIDTH;
  } else {
    return totalWidth;
  }
};

/**
 * Width of a list variable input, based on its longest option rather than on the selected one.
 * Sizing on the selection makes the input resize on every pick, which shifts every following variable
 * and can wrap the toolbar onto another line.
 */
export const getOptionsWidthPx = (options: VariableOption[], font: string): number =>
  options
    .map((option) => option.label)
    .sort((a, b) => b.length - a.length)
    .slice(0, MEASURED_OPTIONS_COUNT)
    .reduce((widest, label) => Math.max(widest, getWidthPx(label, 'list', font)), MIN_VARIABLE_WIDTH);
