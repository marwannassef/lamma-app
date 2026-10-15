import { render, screen } from '@testing-library/react-native';

import Home from '../app/index';
import { i18n, initI18n } from '../src/core/i18n';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('Home', () => {
  beforeAll(() => initI18n('en'));

  it('renders in English', async () => {
    await i18n.changeLanguage('en');
    render(<Home />);
    expect(screen.getByText('Lamma')).toBeTruthy();
    expect(screen.getByText('Spy')).toBeTruthy();
    expect(screen.getByText(/3–12 players/)).toBeTruthy();
    expect(screen.getByText('Werewolf')).toBeTruthy();
    expect(screen.getAllByText('Coming soon')).toHaveLength(1);
  });

  it('renders in Arabic', async () => {
    await i18n.changeLanguage('ar');
    render(<Home />);
    expect(screen.getByText('لمّة')).toBeTruthy();
    expect(screen.getByText('الجاسوس')).toBeTruthy();
    expect(screen.getByText('المستذئب')).toBeTruthy();
  });
});
