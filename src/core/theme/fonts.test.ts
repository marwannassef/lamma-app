import { fontFamilyFor } from './fonts';

describe('fontFamilyFor', () => {
  it('uses Latin fonts for English and Franco text', () => {
    expect(fontFamilyFor('Koshari', 'display', 'bold')).toBe('Baloo2-Bold');
    expect(fontFamilyFor('ta3meya', 'body', 'regular')).toBe('Nunito-Regular');
  });

  it('uses Arabic fonts when the text has Arabic script', () => {
    expect(fontFamilyFor('كشري', 'display', 'extrabold')).toBe('BalooBhaijaan2-ExtraBold');
    expect(fontFamilyFor('لاعب 3', 'body', 'semibold')).toBe('Cairo-SemiBold');
  });
});
