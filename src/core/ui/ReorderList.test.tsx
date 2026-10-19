import { fireEvent, render, screen } from '@testing-library/react-native';

import { Text } from './Text';
import { dropIndex, ReorderList, shiftFor } from './ReorderList';

describe('ReorderList', () => {
  it('drops a row by how many rows it moved past', () => {
    expect(dropIndex(1, 0, 60, 5)).toBe(1);
    expect(dropIndex(1, 95, 60, 5)).toBe(3);
    expect(dropIndex(1, -200, 60, 5)).toBe(0);
    expect(dropIndex(3, 500, 60, 5)).toBe(4);
    expect(dropIndex(2, 100, 0, 5)).toBe(2);
  });

  it('slides the rows in between to make room', () => {
    // dragging row 1 down to row 3: rows 2 and 3 move up
    expect([0, 1, 2, 3, 4].map((i) => shiftFor(i, 1, 3, 60))).toEqual([0, 0, -60, -60, 0]);
    // dragging row 3 up to row 1: rows 1 and 2 move down
    expect([0, 1, 2, 3, 4].map((i) => shiftFor(i, 3, 1, 60))).toEqual([0, 60, 60, 0, 0]);
    expect(shiftFor(2, -1, 0, 60)).toBe(0);
  });

  it('moves rows with screen-reader actions', () => {
    const onMove = jest.fn();
    render(
      <ReorderList
        count={3}
        onMove={onMove}
        renderRow={(i) => <Text>{`Row ${i}`}</Text>}
        handleLabel={(i) => `Drag row ${i}`}
        moveUpLabel={() => 'Up'}
        moveDownLabel={() => 'Down'}
      />,
    );
    expect(screen.getByText('Row 2')).toBeTruthy();
    const first = screen.getByLabelText('Drag row 0');
    expect(first.props.accessibilityActions).toEqual([{ name: 'moveDown', label: 'Down' }]);
    fireEvent(first, 'accessibilityAction', { nativeEvent: { actionName: 'moveDown' } });
    fireEvent(screen.getByLabelText('Drag row 2'), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveUp' },
    });
    expect(onMove.mock.calls).toEqual([
      [0, 1],
      [2, 1],
    ]);
  });
});
