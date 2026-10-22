// "Join a game": one entry for every game's network mode. The host's room says which game it is.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { GuestSnapshot, Lobby } from '@/core/room';
import { JoinScreen } from '@/core/room/ui';
import { getGame } from '@/games/registry';
import { BlendInGuest } from '@/games/blendIn/screens/Guest';
import { SpyGuest } from '@/games/spy/screens/Guest';
import { WerewolfGuest } from '@/games/werewolf/screens/Guest';

/** Each game's guest screens, by the room's game id. */
const GUEST: Record<string, (s: GuestSnapshot) => ReactNode> = {
  werewolf: (s) => <WerewolfGuest snapshot={s} />,
  spy: (s) => <SpyGuest snapshot={s} />,
  blendIn: (s) => <BlendInGuest snapshot={s} />,
};

export default function Join() {
  const { t } = useTranslation(['common', 'spy', 'blendIn']);
  return (
    <JoinScreen
      renderGame={(s) => (s.game ? (GUEST[s.game]?.(s) ?? null) : null)}
      gameTitle={(lobby: Lobby) => {
        if (!GUEST[lobby.game]) return null;
        // Werewolf and Mafia are one game with two themes.
        const id = lobby.game === 'werewolf' && lobby.theme === 'mafia' ? 'mafia' : lobby.game;
        const game = getGame(id);
        return game ? t(game.titleKey as 'common:games.werewolf.title') : null;
      }}
    />
  );
}
