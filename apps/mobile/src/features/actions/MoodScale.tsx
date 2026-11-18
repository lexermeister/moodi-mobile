import { useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const TRACK_INSET = 8;

export function MoodScale({ label, value, onChange, disabled = false, low = 'Low', high = 'High', prominent = false }: {
  label: string; value: number | null; onChange: (value: number) => void;
  disabled?: boolean; low?: string; high?: string; prominent?: boolean;
}) {
  const [typed, setTyped] = useState('');
  const [inputError, setInputError] = useState(false);
  const [scaleWidth, setScaleWidth] = useState(0);
  const currentValue = useRef(value);

  useEffect(() => { currentValue.current = value; }, [value]);

  function setScore(score: number) {
    if (disabled || currentValue.current === score) return;
    currentValue.current = score;
    onChange(score);
  }

  function setScoreFromTouch(event: GestureResponderEvent) {
    if (scaleWidth <= TRACK_INSET * 2) return;
    const position = (event.nativeEvent.locationX - TRACK_INSET) / (scaleWidth - TRACK_INSET * 2);
    setScore(Math.max(0, Math.min(10, Math.round(position * 10))));
  }

  const scorePosition = value === null || scaleWidth <= TRACK_INSET * 2
    ? null : TRACK_INSET + (scaleWidth - TRACK_INSET * 2) * value / 10;
  function submitTyped() {
    const number = Number(typed.trim());
    if (!/^\d{1,2}$/.test(typed.trim()) || !Number.isInteger(number) || number < 0 || number > 10) {
      setInputError(true); return;
    }
    setScore(number); setTyped(''); setInputError(false);
  }
  return <View style={styles.group}><View style={[styles.card, prominent && styles.prominent]}>
    {prominent ? <View style={styles.primaryScore}><Text style={styles.primaryNumber}>{value ?? '—'}</Text><Text style={styles.primaryOutOf}> / 10</Text></View>
      : <View style={styles.heading}><Text style={styles.label}>{label}</Text><Text style={styles.score}>{value === null ? '—' : `${value}/10`}</Text></View>}
    <View style={styles.scale} onLayout={event => setScaleWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !disabled} onMoveShouldSetResponder={() => !disabled}
      onResponderGrant={setScoreFromTouch} onResponderMove={setScoreFromTouch} onResponderRelease={setScoreFromTouch}
      onResponderTerminationRequest={() => false}
      accessible accessibilityRole="adjustable" accessibilityLabel={label}
      accessibilityState={{ disabled }} accessibilityValue={value === null ? { text: 'Not rated' } : { min: 0, max: 10, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'increment') setScore(Math.min(10, (currentValue.current ?? 0) + 1));
        if (event.nativeEvent.actionName === 'decrement') setScore(Math.max(0, (currentValue.current ?? 0) - 1));
      }}>
      <View pointerEvents="none" style={styles.track} />
      {scorePosition !== null ? <View pointerEvents="none" style={[styles.fill, { width: scorePosition - TRACK_INSET }]} /> : null}
      <View pointerEvents="none" style={styles.dots}>
        {Array.from({ length: 11 }, (_, score) => <View key={score} style={styles.dot} />)}
      </View>
      {scorePosition !== null ? <View pointerEvents="none" style={[styles.thumb, { left: scorePosition - 9 }]} /> : null}
      <View pointerEvents="none" style={styles.numbers}>
        {Array.from({ length: 11 }, (_, score) => <Text key={score}
          style={[styles.number, value === score && styles.selectedNumber]}>{score}</Text>)}
      </View>
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
  scale: { position: 'relative', height: 53 },
  track: { position: 'absolute', top: 12, left: 8, right: 8, height: 4, borderRadius: 3, backgroundColor: '#6A6179' },
  fill: { position: 'absolute', top: 12, left: 8, height: 4, borderRadius: 3, backgroundColor: '#C9B7FF' },
  dots: { position: 'absolute', top: 10.5, left: 5, right: 5, flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#B9AFCB' },
  thumb: { position: 'absolute', top: 5.5, width: 18, height: 18, borderRadius: 9, backgroundColor: '#C9B7FF', borderWidth: 3, borderColor: '#24222B' },
  numbers: { position: 'absolute', top: 31, left: 3, right: 3, flexDirection: 'row', justifyContent: 'space-between' },
  number: { color: '#C7C2D0', fontSize: 11, fontWeight: '700' }, selectedNumber: { color: '#C9B7FF' },
  endLabels: { flexDirection: 'row', justifyContent: 'space-between' }, endLabel: { color: '#C7C2D0', fontSize: 12, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: 6 }, input: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: '#55515F', borderRadius: 10, paddingHorizontal: 10, color: '#FFFFFF', fontSize: 14 },
  send: { width: 43, minHeight: 42, borderRadius: 10, backgroundColor: '#C9B7FF', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#24212E', fontSize: 24 }, disabled: { opacity: 0.45 }, error: { color: '#FFB4AB', fontSize: 12 },
});
