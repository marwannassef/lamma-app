import 'i18next';

import type common from '../../../locales/en/common.json';
import type spy from '../../../locales/en/spy.json';
import type werewolf from '../../../locales/en/werewolf.json';
import type mafia from '../../../locales/en/mafia.json';
import type blendIn from '../../../locales/en/blendIn.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      spy: typeof spy;
      werewolf: typeof werewolf;
      mafia: typeof mafia;
      blendIn: typeof blendIn;
    };
  }
}
