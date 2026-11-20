import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

type TodoKind = 'session' | 'mood' | 'activity' | 'recording';

const icons = {
  session: { ios: 'doc.text', android: 'description', web: 'description' },
  mood: { ios: 'bell', android: 'notifications', web: 'notifications' },
  activity: { ios: 'heart', android: 'favorite', web: 'favorite' },
  recording: { ios: 'mic', android: 'mic', web: 'mic' },
} as const;

export function TodoRow({ kind, title, subtitle, onPress }: {
  kind: TodoKind; title: string; subtitle: string; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`}
    onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <View style={[styles.icon, kind === 'session' ? styles.sessionIcon : kind === 'recording' ? styles.recordingIcon : kind === 'activity' ? styles.activityIcon : styles.moodIcon]}>
      <SymbolView name={icons[kind]} size={22} tintColor={kind === 'session' ? '#287453' : kind === 'recording' ? '#6045B7' : kind === 'activity' ? '#7B4D73' : '#2F7382'} />
    </View>
    <View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>
    <Text style={styles.arrow}>›</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { minHeight: 56, padding: 8, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 14,
    backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.65 },
  icon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sessionIcon: { backgroundColor: '#E5F4ED' }, moodIcon: { backgroundColor: '#E3F4F7' },
  activityIcon: { backgroundColor: '#F6E9F1' },
  recordingIcon: { backgroundColor: '#EEE8FF' },
  copy: { flex: 1, gap: 2 }, title: { color: theme.colors.ink, fontSize: 14, fontWeight: '700' },
  subtitle: { color: theme.colors.muted, fontSize: 12 }, arrow: { color: theme.colors.muted, fontSize: 24 },
});
