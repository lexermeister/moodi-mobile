import { Tabs } from 'expo-router';
import { type ColorValue, StyleSheet, Text } from 'react-native';

function TabIcon({ label, color }: { label: string; color: ColorValue }) {
  return <Text style={[styles.icon, { color }]}>{label}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#ca3d28',
        tabBarInactiveTintColor: '#68716b',
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
      }}>
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarIcon: ({ color }) => <TabIcon color={color} label="◉" />,
        }}
      />
      <Tabs.Screen
        name="actions"
        options={{
          title: 'Actions',
          tabBarIcon: ({ color }) => <TabIcon color={color} label="✓" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 18, fontWeight: '900' },
  label: { fontSize: 11, fontWeight: '800' },
  tabBar: { borderTopColor: '#e5ded2' },
});
