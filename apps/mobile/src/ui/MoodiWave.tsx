import { View } from 'react-native';

export function MoodiWave({ color = '#D7C8FF', width = 26 }: { color?: string; width?: number }) {
  const diameter = width / 3;
  const half = diameter / 2;
  const circle = { width: diameter, height: diameter, borderRadius: half, borderWidth: 2.3, borderColor: color };
  return <View accessible={false} style={{ width, height: diameter + 4 }}>
    <View style={{ position: 'absolute', left: 0, top: 2, width: diameter, height: half, overflow: 'hidden' }}>
      <View style={circle} />
    </View>
    <View style={{ position: 'absolute', left: diameter, top: half + 2, width: diameter, height: half, overflow: 'hidden' }}>
      <View style={[circle, { top: -half }]} />
    </View>
    <View style={{ position: 'absolute', left: diameter * 2, top: 2, width: diameter, height: half, overflow: 'hidden' }}>
      <View style={circle} />
    </View>
  </View>;
}
