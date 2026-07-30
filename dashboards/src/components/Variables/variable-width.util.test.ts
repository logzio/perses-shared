//LOGZ.IO CHANGE:: whole file
import { createTheme } from '@mui/material';
import { VariableOption } from '@perses-dev/plugin-system';
import { MAX_VARIABLE_WIDTH, MIN_VARIABLE_WIDTH } from '../../constants';
import { getInputFont, getOptionsWidthPx, getWidthPx } from './variable-width.util';

// jsdom has no canvas implementation, so measurement falls back to a fixed width per character.
// Stubbing it keeps these tests deterministic even if a canvas implementation gets installed.
HTMLCanvasElement.prototype.getContext = (): null => null;

const FONT = '400 14px Inter, sans-serif';

function option(label: string): VariableOption {
  return { label, value: label };
}

describe('variable-width.util', () => {
  describe('getOptionsWidthPx', () => {
    it('should return the same width for every option in the list, so selecting a value never resizes the input', () => {
      const options = [option('eu-west-2'), option('ap-northeast-1'), option('us-east-1')];

      const widthFromFullList = getOptionsWidthPx(options, FONT);
      const widthFromReorderedList = getOptionsWidthPx([...options].reverse(), FONT);

      expect(widthFromFullList).toBe(widthFromReorderedList);
      expect(widthFromFullList).toBe(getWidthPx('ap-northeast-1', 'list', FONT));
    });

    it('should size on the longest option when a shorter option is selected', () => {
      const options = [option('eu-west-2'), option('ap-northeast-1')];

      expect(getOptionsWidthPx(options, FONT)).toBeGreaterThan(getWidthPx('eu-west-2', 'list', FONT));
    });

    it('should measure the longest option when it is not among the first ones', () => {
      const options = [
        option('a'),
        option('b'),
        option('c'),
        option('d'),
        option('e'),
        option('f'),
        option('the-longest-option-of-them-all'),
      ];

      expect(getOptionsWidthPx(options, FONT)).toBe(getWidthPx('the-longest-option-of-them-all', 'list', FONT));
    });

    it('should not mutate the options it receives', () => {
      const options = [option('eu-west-2'), option('ap-northeast-1'), option('us-east-1')];

      getOptionsWidthPx(options, FONT);

      expect(options.map((o) => o.label)).toEqual(['eu-west-2', 'ap-northeast-1', 'us-east-1']);
    });

    it('should return the minimum width when there are no options yet', () => {
      expect(getOptionsWidthPx([], FONT)).toBe(MIN_VARIABLE_WIDTH);
    });

    it('should cap at the maximum variable width when options are very long', () => {
      expect(getOptionsWidthPx([option('a'.repeat(500))], FONT)).toBe(MAX_VARIABLE_WIDTH);
    });
  });

  describe('getWidthPx', () => {
    it('should never go below the minimum width when the value is short', () => {
      expect(getWidthPx('a', 'list', FONT)).toBe(MIN_VARIABLE_WIDTH);
    });

    it('should never exceed the maximum width when the value is long', () => {
      expect(getWidthPx('a'.repeat(500), 'text', FONT)).toBe(MAX_VARIABLE_WIDTH);
    });

    it('should reserve room for the dropdown arrow on list variables', () => {
      const value = 'a-reasonably-long-variable-value';

      expect(getWidthPx(value, 'list', FONT)).toBeGreaterThan(getWidthPx(value, 'text', FONT));
    });
  });

  describe('getInputFont', () => {
    it('should build the font from the theme instead of hardcoding one', () => {
      const theme = createTheme({
        typography: {
          htmlFontSize: 16,
          body1: { fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 400 },
        },
      });

      expect(getInputFont(theme)).toBe('400 14px Inter, sans-serif');
    });

    it('should keep pixel font sizes as they are', () => {
      const theme = createTheme({
        typography: { body1: { fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 500 } },
      });

      expect(getInputFont(theme)).toBe('500 13px Roboto, sans-serif');
    });
  });
});
