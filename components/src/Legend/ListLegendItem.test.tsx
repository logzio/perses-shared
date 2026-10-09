import { render, screen } from '@testing-library/react';
import { ListLegendItem } from './ListLegendItem';

describe('ListLegendItem', () => {
  test('should grey out the label of a muted item', () => {
    render(
      <ListLegendItem
        item={{ id: 'one', label: 'Label One', color: '#ff0000', isMuted: true }}
        index={0}
        onClick={jest.fn()}
      />
    );

    expect(screen.getByText('Label One')).toHaveStyle({ opacity: '0.5' });
  });

  test('should render the label of an item that is not muted at full opacity', () => {
    render(<ListLegendItem item={{ id: 'one', label: 'Label One', color: '#ff0000' }} index={0} onClick={jest.fn()} />);

    expect(screen.getByText('Label One')).not.toHaveStyle({ opacity: '0.5' });
  });
});
