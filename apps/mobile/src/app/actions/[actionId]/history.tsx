import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RatingHistoryScreen } from '@/features/actions/RatingHistoryScreen';

export default function ActionHistoryRoute() {
  const router = useRouter();
  const { actionId } = useLocalSearchParams<{ actionId: string }>();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to check-in"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backText}>‹ Check-in</Text>
          </Pressable>
          <Text style={styles.title}>Rating history</Text>
          <Text style={styles.subtitle}>A factual record of the entries you saved.</Text>
        </View>
        {typeof actionId === 'string' ? (
          <RatingHistoryScreen actionId={actionId} />
        ) : (
          <Text style={styles.errorText}>Rating history could not be opened.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#fbf8f2', flex: 1 },
  content: { gap: 18, paddingBottom: 36, paddingHorizontal: 18, paddingTop: 10 },
  header: { gap: 5 },
  backButton: { alignSelf: 'flex-start', paddingBottom: 6, paddingVertical: 4 },
  backText: { color: '#ca3d28', fontSize: 15, fontWeight: '800' },
  title: { color: '#1e2421', fontSize: 30, fontWeight: '900' },
  subtitle: { color: '#68716b', fontSize: 14, lineHeight: 20 },
  errorText: { color: '#982e22', fontSize: 13 },
  pressed: { opacity: 0.68 },
});
