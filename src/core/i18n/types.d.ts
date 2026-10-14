import 'i18next';

import type common from '../../../locales/en/common.json';
import type spy from '../../../locales/en/spy.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: { common: typeof common; spy: typeof spy };
  }
}
