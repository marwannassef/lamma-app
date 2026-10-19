import { Image, StyleSheet, View } from 'react-native';

/** The "moonlit village" backdrop for Werewolf's public screens (§11). */
export function MoonlitBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* An explicit 100% size: on web an absolutely filled image keeps its intrinsic size. */}
      <Image
        source={require('@/assets/images/werewolf/moonlit.png')}
        style={styles.image}
        resizeMode="cover"
        accessible={false}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({ image: { width: '100%', height: '100%' } });
