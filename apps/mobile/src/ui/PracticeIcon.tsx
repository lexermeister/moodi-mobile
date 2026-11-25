import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';
export function PracticeIcon() {
  return <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: '#E3F4F7', alignItems: 'center', justifyContent: 'center' }}>
    <SymbolView name={{ ios: 'wind', android: 'air', web: 'air' }} size={22} tintColor="#2F7382" />
  </View>;
}
