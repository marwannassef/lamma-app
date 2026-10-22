import type { Cue, SoundId } from '@/core/audio';

import { teamOf, type GameState, type StoryLine } from './engine';

/** What changes between the themes' soundscapes (§15.3); Kids mode swaps harsh stingers. */
function sounds(g: GameState) {
  const mafia = g.theme === 'mafia';
  const harsh = (id: SoundId): SoundId => (g.kids && mafia ? 'softKnock' : id);
  return {
    ambience: (mafia ? 'cityAmbience' : 'nightAmbience') as SoundId,
    discussion: (mafia ? 'noirJazz' : 'tavern') as SoundId,
    dawn: mafia ? harsh('siren') : ('dawnSting' as SoundId),
    // An arrest: the cell door for the Mafia, a mugshot camera flash for anyone else.
    reveal: (team: string): SoundId =>
      mafia
        ? team === 'wolves'
          ? harsh('jailClang')
          : 'cameraFlash'
        : team === 'wolves'
          ? 'revealWolves'
          : 'revealVillage',
    wolvesWin: mafia ? harsh('siren') : ('revealWolves' as SoundId),
  };
}

/** Re-cues only when the phase (not a seat inside it) changes. */
export const audioKey = (g: GameState) => `${g.phase.t}-${g.night}-${g.day}`;

/**
 * What each Werewolf phase sounds like (§10). Secret screens stay quiet apart from the masking
 * ambience, and nothing ever sounds on a selection.
 */
export function audioCue(
  g: GameState,
  nameOf: (id: number) => string,
  roleName: (id: string) => string,
  tell: (g: GameState, lines: readonly StoryLine[]) => string[],
): Cue {
  const ph = g.phase;
  const sfx = sounds(g);
  const ambience = { id: sfx.ambience, volume: g.rules.ambienceVolume };
  switch (ph.t) {
    case 'discovery':
      return { loops: { ambience: null, music: null } };
    case 'nightIntro': {
      // Tonight's setting opens the night and comes back in the dawn story (§16.3).
      const key = g.story.setting
        ? `story.${g.theme}.settings.${g.story.setting}.fall`
        : 'say.nightFall';
      return { loops: { ambience, music: null }, sfx: 'nightFall', line: { key } };
    }
    case 'glance':
      return {
        loops: { ambience, music: { id: 'heartbeat', volume: 0.8 } },
        line: { key: g.wolfKills === 2 ? 'say.wolvesTwice' : 'say.wolvesWake' },
      };
    case 'pass':
      // The ambience masks taps and footsteps during the pass (§10); it runs at full rule volume.
      return { loops: { ambience, music: null }, line: { key: 'say.passStart' } };
    case 'morning':
      // The dawn story (§16) is read aloud exactly as it's shown on screen.
      return {
        loops: { ambience: null, music: null },
        ...(ph.report.deaths.length > 0 && { sfx: sfx.dawn }),
        line: { text: tell(g, ph.story).join(' ') },
      };
    case 'discussion':
      return { loops: { ambience: null, music: { id: sfx.discussion, volume: 0.45 } } };
    case 'vote':
      return { loops: { music: null }, line: { key: 'say.voteCountdown' } };
    case 'execution': {
      if (ph.playerId == null) return { loops: { music: null }, line: { key: 'say.nobody' } };
      const player = g.players[ph.playerId];
      const name = nameOf(ph.playerId);
      if (!g.rules.revealRoleOnDeath || !player) {
        return { loops: { music: null }, line: { key: 'say.banished', params: { name } } };
      }
      const team = teamOf(player.dealtRole);
      return {
        loops: { music: null },
        sfx: sfx.reveal(team),
        line: { key: `say.reveal.${team}`, params: { name, role: roleName(player.dealtRole) } },
      };
    }
    case 'gameOver':
      return {
        loops: { ambience: null, music: null },
        sfx: ph.result.outcome === 'wolves' ? sfx.wolvesWin : 'fanfare',
        line: { key: `say.win.${ph.result.outcome}` },
      };
    default:
      return {};
  }
}
