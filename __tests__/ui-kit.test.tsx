import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { i18n, initI18n } from '../src/core/i18n';
import { ThemeProvider } from '../src/core/theme';
import {
  Button,
  Chip,
  ConfirmInline,
  Panel,
  Scoreboard,
  Stepper,
  Text,
  Toggle,
} from '../src/core/ui';

beforeAll(() => initI18n('en'));

describe.each(['light', 'dark'] as const)('UI kit (%s)', (scheme) => {
  const wrap = (ui: React.ReactElement) =>
    render(<ThemeProvider scheme={scheme}>{ui}</ThemeProvider>);

  it('Button fires onPress', () => {
    const onPress = jest.fn();
    wrap(<Button label="Go" onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Go'));
    expect(onPress).toHaveBeenCalled();
  });

  it('Stepper explains the limit instead of disabling', () => {
    const onChange = jest.fn();
    wrap(
      <Stepper
        testID="n"
        label="Players"
        value={3}
        min={3}
        max={4}
        onChange={onChange}
        decreaseLabel="Fewer"
        increaseLabel="More"
        minHint="At least 3"
        maxHint="At most 4"
      />,
    );
    fireEvent.press(screen.getByLabelText('Fewer'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('At least 3')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('More'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('Chip, Toggle, Panel, ConfirmInline and Scoreboard render', () => {
    const onConfirm = jest.fn();
    wrap(
      <Panel title="Panel">
        <Chip title="Food" subtitle="Akl" emoji="🍕" selected onPress={jest.fn()} />
        <Toggle testID="t" label="Sound" value onChange={jest.fn()} />
        <ConfirmInline
          question="Sure?"
          confirmLabel="Yes"
          cancelLabel="No"
          onConfirm={onConfirm}
          onCancel={jest.fn()}
        />
        <Scoreboard scores={[1, 3]} gains={[0, 2]} />
        <Text>كلمة</Text>
      </Panel>,
    );
    expect(screen.getByText('Panel')).toBeTruthy();
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText(/\+2$/)).toBeTruthy();
    expect(screen.getByText(/👑/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Yes'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('renders Arabic', async () => {
    await i18n.changeLanguage('ar');
    wrap(<Scoreboard scores={[0, 0, 0]} />);
    expect(screen.getByText('لاعب 1')).toBeTruthy();
    await act(() => i18n.changeLanguage('en'));
  });
});
