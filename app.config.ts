import fs from 'node:fs';
import path from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

// Native app-name strings come from locales/<code>/native.json, so a new locale needs no config edit.
function nativeLocales(): Record<string, string> {
  const dir = path.join(__dirname, 'locales');
  return Object.fromEntries(
    fs
      .readdirSync(dir)
      .filter((code) => fs.existsSync(path.join(dir, code, 'native.json')))
      .map((code) => [code, `./locales/${code}/native.json`]),
  );
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  locales: nativeLocales(),
});
