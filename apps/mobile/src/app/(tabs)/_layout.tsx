import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoodiPanel } from '@/features/shell/MoodiPanel';
import { theme } from '@/ui/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return <View style={styles.root}>
    <Tabs screenOptions={{ headerShown: false,
      tabBarActiveTintColor: theme.colors.accent, tabBarInactiveTintColor: theme.colors.muted,
      tabBarStyle: { height: 64 + insets.bottom, paddingTop: 8, paddingBottom: insets.bottom + 4, borderTopColor: theme.colors.line, backgroundColor: theme.colors.surface },
      tabBarLabelStyle: { fontSize: 12, fontWeight: '600' } }}>
      <Tabs.Screen name="journey" options={{ title: 'Journey', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>▤</Text> }} />
      <Tabs.Screen name="moodi" options={{ title: 'Moodi', tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>⌂</Text> }} />
      <Tabs.Screen name="sessions" options={{ href: null }} />
      <Tabs.Screen name="actions" options={{ href: null }} />
    </Tabs>
    <MoodiPanel />
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, icon: { fontSize: 26 } });
