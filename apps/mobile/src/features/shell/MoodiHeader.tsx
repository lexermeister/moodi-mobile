import { StyleSheet, Text, View } from 'react-native';
import { MoodiWave } from '@/ui/MoodiWave';
import { DemoResetButton } from './DemoResetButton';

export function MoodiHeader() {
  return <View style={styles.header}>
    <View style={styles.brand} accessibilityLabel="Moodi">
      <View style={styles.mark}><MoodiWave color="#C9B7FF" width={26} /></View>
      <Text style={styles.wordmark}>moodi<Text style={styles.dot}>.</Text></Text>
    </View>
    <DemoResetButton />
  </View>;
}

const styles = StyleSheet.create({
  header: { height: 58, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E9E6EF',
    backgroundColor: '#F8F7FB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#24222B',
    alignItems: 'center', justifyContent: 'center' },
  wordmark: { color: '#1F1E26', fontSize: 24, fontWeight: '800', letterSpacing: -1.2 },
  dot: { color: '#6045B7' },
});
