import { Image, StyleSheet, View } from 'react-native';

import type { Theme } from '../engine';

const MOONLIT = require('@/assets/images/werewolf/moonlit.png');
const CITY = require('@/assets/images/mafia/city.png');

/** The "moonlit village" backdrop for Werewolf's public screens (§11), or Mafia's noir city (§15.3). */
export function MoonlitBackground({ theme = 'werewolf' }: { theme?: Theme }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* An explicit 100% size: on web an absolutely filled image keeps its intrinsic size. */}
      <Image
        source={theme === 'mafia' ? CITY : MOONLIT}
        style={styles.image}
        resizeMode="cover"
        accessible={false}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({ image: { width: '100%', height: '100%' } });
