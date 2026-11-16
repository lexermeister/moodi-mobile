import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function MoodScale({ label, value, onChange, disabled = false, low = 'Low', high = 'High' }: {
  label: string; value: number | null; onChange: (value: number) => void;
  disabled?: boolean; low?: string; high?: string;
}) {
  const [width, setWidth] = useState(1);
  const choose = (x: number) => { if (!disabled) onChange(Math.max(0, Math.min(10, Math.round(x / width * 10)))); };
  return <View style={styles.group}>
    <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.score}>{value ?? '—'}<Text style={styles.unit}> / 10</Text></Text></View>
    <View accessible accessibilityRole="adjustable" accessibilityLabel={label}
      accessibilityState={{ disabled }} accessibilityValue={{ min: 0, max: 10, ...(value === null ? { text: 'Not answered' } : { now: value }) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => { if (!disabled) onChange(Math.max(0, Math.min(10,
        value === null ? 5 : value + (event.nativeEvent.actionName === 'increment' ? 1 : -1)))); }}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !disabled} onMoveShouldSetResponder={() => !disabled}
      onResponderGrant={event => choose(event.nativeEvent.locationX)}
      onResponderMove={event => choose(event.nativeEvent.locationX)} style={styles.touch}>
      <View pointerEvents="none" style={styles.track}><View style={[styles.fill, { width: `${(value ?? 0) * 10}%` }]} /></View>
      <View pointerEvents="none" style={[styles.thumb, { left: `${(value ?? 5) * 10}%`, opacity: value === null ? 0.45 : 1 }]} />
    </View>
    <View style={styles.row}><Text style={styles.hint}>0 · {low}</Text><Text style={styles.hint}>10 · {high}</Text></View>
    {value === null ? <Text style={styles.hint}>Choose a score to answer.</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: 8 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: '#f8f7fb', fontSize: 16, fontWeight: '600' }, score: { color: '#c8b8ff', fontSize: 36 },
  unit: { fontSize: 14, color: '#c7c3d0' }, hint: { color: '#c7c3d0', fontSize: 13 },
  touch: { height: 48, justifyContent: 'center', marginHorizontal: 12 }, track: { height: 6, borderRadius: 3, backgroundColor: '#514b63' },
  fill: { height: 6, backgroundColor: '#c8b8ff', borderRadius: 3 },
  thumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, marginLeft: -12, backgroundColor: '#d7caff' },
});
