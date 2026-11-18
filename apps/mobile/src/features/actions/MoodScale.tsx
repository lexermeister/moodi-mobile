import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export function MoodScale({ label, value, onChange, disabled = false, low = 'Low', high = 'High', prominent = false }: {
  label: string; value: number | null; onChange: (value: number) => void;
  disabled?: boolean; low?: string; high?: string; prominent?: boolean;
}) {
  const [typed, setTyped] = useState('');
  const [inputError, setInputError] = useState(false);
  function submitTyped() {
    const number = Number(typed.trim());
    if (!/^\d{1,2}$/.test(typed.trim()) || !Number.isInteger(number) || number < 0 || number > 10) {
      setInputError(true); return;
    }
    onChange(number); setTyped(''); setInputError(false);
  }
  return <View style={styles.group}><View style={[styles.card, prominent && styles.prominent]}>
    {prominent ? <View style={styles.primaryScore}><Text style={styles.primaryNumber}>{value ?? '—'}</Text><Text style={styles.primaryOutOf}> / 10</Text></View>
      : <View style={styles.heading}><Text style={styles.label}>{label}</Text><Text style={styles.score}>{value === null ? '—' : `${value}/10`}</Text></View>}
    <View style={styles.scale}>
      <View pointerEvents="none" style={styles.track} />
      {value !== null ? <View pointerEvents="none" style={[styles.fill, { width: `${value * 10}%` }]} /> : null}
      {Array.from({ length: 11 }, (_, score) => <Pressable key={score} accessibilityRole="button"
        accessibilityLabel={`${label}: ${score} out of 10`} accessibilityState={{ selected: value === score, disabled }}
        disabled={disabled} onPress={() => onChange(score)} style={styles.tick}>
        <View style={[styles.dot, value === score && styles.selectedDot]} />
        <Text style={[styles.number, value === score && styles.selectedNumber]}>{score}</Text>
      </Pressable>)}
    </View>
    <View style={styles.endLabels}><Text style={styles.endLabel}>{low}</Text><Text style={styles.endLabel}>{high}</Text></View>
    </View>
    <View style={styles.inputRow}>
      <TextInput accessibilityLabel={`Enter ${label} score`} keyboardType="number-pad" value={typed} onChangeText={text => { setTyped(text); setInputError(false); }}
        onSubmitEditing={submitTyped} placeholder={prominent ? 'e.g. 6 out of 10' : `e.g. ${label} 4`}
        placeholderTextColor="#AAA5B5" editable={!disabled} maxLength={2} style={styles.input} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Save ${label} score`} disabled={disabled || !typed.trim()} onPress={submitTyped}
        style={[styles.send, (disabled || !typed.trim()) && styles.disabled]}><Text style={styles.sendText}>↑</Text></Pressable>
    </View>
    {inputError ? <Text accessibilityRole="alert" style={styles.error}>Choose a whole number from 0 to 10.</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  card: { gap: 15, borderWidth: 1, borderColor: '#4A4655', borderRadius: 15, backgroundColor: '#2E2B36', padding: 13 },
  prominent: { backgroundColor: '#332E40' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }, score: { color: '#ACE3C8', fontSize: 17, fontWeight: '800' },
  primaryScore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7 },
  primaryNumber: { color: '#C9B7FF', fontSize: 51, fontWeight: '800' }, primaryOutOf: { color: '#C7C2D0', fontSize: 20 },
  scale: { flexDirection: 'row', justifyContent: 'space-between', position: 'relative', paddingTop: 4 },
  track: { position: 'absolute', top: 12, left: 7, right: 7, height: 4, borderRadius: 3, backgroundColor: '#6A6179' },
  fill: { position: 'absolute', top: 12, left: 7, height: 4, borderRadius: 3, backgroundColor: '#C9B7FF' },
  tick: { alignItems: 'center', flex: 1, minHeight: 46, justifyContent: 'space-between' },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 5, backgroundColor: '#B9AFCB' },
  selectedDot: { width: 17, height: 17, borderRadius: 9, marginTop: 0, backgroundColor: '#C9B7FF', borderWidth: 3, borderColor: '#24222B' },
  number: { color: '#C7C2D0', fontSize: 11, fontWeight: '700' }, selectedNumber: { color: '#C9B7FF' },
  endLabels: { flexDirection: 'row', justifyContent: 'space-between' }, endLabel: { color: '#C7C2D0', fontSize: 12, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: 6 }, input: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: '#55515F', borderRadius: 10, paddingHorizontal: 10, color: '#FFFFFF', fontSize: 14 },
  send: { width: 43, minHeight: 42, borderRadius: 10, backgroundColor: '#C9B7FF', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#24212E', fontSize: 24 }, disabled: { opacity: 0.45 }, error: { color: '#FFB4AB', fontSize: 12 },
});
