import { render, screen } from '@testing-library/react-native';

import Home from '../app/index';
import { i18n, initI18n } from '../src/core/i18n';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Home', () => {
  beforeAll(() => initI18n('en'));

  it('renders in English', async () => {
    await i18n.changeLanguage('en');
    render(<Home />);
    expect(screen.getByText('Lamma')).toBeTruthy();
    expect(screen.getByText('Spy')).toBeTruthy();
    expect(screen.getByText('3–12 players')).toBeTruthy();
  });

  it('renders in Arabic', async () => {
    await i18n.changeLanguage('ar');
    render(<Home />);
    expect(screen.getByText('لمّة')).toBeTruthy();
    expect(screen.getByText('الجاسوس')).toBeTruthy();
  });
});
