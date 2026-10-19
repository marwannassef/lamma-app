import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { i18n, initI18n } from '../src/core/i18n';
import BlendInSetup from '../src/games/blendIn/screens/Setup';
import SpySetup from '../src/games/spy/screens/Setup';
import WerewolfSetup from '../src/games/werewolf/screens/Setup';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));

beforeAll(() => initI18n('en'));

describe.each([
  ['Spy', SpySetup, 'Each player taps the card'],
  ['Werewolf', WerewolfSetup, 'Discovery: each player holds the seal'],
  ['Blend In', BlendInSetup, 'Take turns saying exactly one word'],
])('%s setup', (_name, Setup, playStep) => {
  it('shows how to set up and play when opened', () => {
    render(<Setup />);
    expect(screen.queryByText('Setting up')).toBeNull();
    fireEvent.press(screen.getByTestId('how-to'));
    expect(screen.getByText(/Setting up/)).toBeTruthy();
    expect(screen.getByText(/Playing/)).toBeTruthy();
    expect(screen.getByText(new RegExp(playStep))).toBeTruthy();
  });
});

it('reads in Arabic', async () => {
  await act(() => i18n.changeLanguage('ar'));
  render(<SpySetup />);
  fireEvent.press(screen.getByTestId('how-to'));
  expect(screen.getByText(/التجهيز/)).toBeTruthy();
  await act(() => i18n.changeLanguage('en'));
});
