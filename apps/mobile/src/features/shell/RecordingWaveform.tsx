import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const barHeights = [12, 25, 43, 34, 66, 51, 76, 49, 69, 36, 51, 30, 14];
const pulsePatterns = [
  [0.7, 1.2, 0.85, 1.1, 0.7],
  [1, 0.7, 1.2, 0.8, 1],
  [0.8, 1.1, 0.65, 1.2, 0.8],
];

export function RecordingWaveform() {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(Animated.timing(progress, {
      toValue: 1,
      duration: 1400,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return <View accessible={false} style={styles.waveform}>
    {barHeights.map((height, index) => <Animated.View key={index} style={[styles.bar, { height,
      transform: [{ scaleY: progress.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: pulsePatterns[index % pulsePatterns.length],
      }) }],
    }]} />)}
  </View>;
}

const styles = StyleSheet.create({
  waveform: { height: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  bar: { width: 5, borderRadius: 3, backgroundColor: '#C6B4FF' },
});
