import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Page, typography } from '@/ui/components';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { useMoodiPanel } from './MoodiPanel';
import { RecentMoodChart } from './RecentMoodChart';
import { TodayMoodActions } from '../actions/TodayMoodActions';
import { MoodEntriesSection } from '../actions/MoodEntriesSection';
import { DemoResetButton } from './DemoResetButton';
import { ReviewSessionTodo } from './ReviewSessionTodo';

export function MoodiScreen() {
  const { setOpen, entryVersion } = useMoodiPanel();
  const library = useSharedRecordingLibrary();
  return <Page>
    <View style={styles.header}>
      <View style={styles.heading}><Text style={typography.body}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <Text style={typography.title}>Today</Text></View>
      <DemoResetButton />
    </View>
    <Text style={typography.heading}>To do</Text>
    <ReviewSessionTodo />
    <TodayMoodActions refreshKey={entryVersion} />
    <Card><Text style={typography.heading}>{library.isRecording ? 'Session in progress' : 'A space for your session'}</Text>
      <Text style={typography.body}>{library.isRecording ? 'Open Moodi to see your recording.' : 'When you’re ready, open Moodi to record a session.'}</Text>
      <Button label={library.isRecording ? 'Open recording' : 'Open Moodi'} onPress={() => setOpen(true)} /></Card>
    <RecentMoodChart key={entryVersion} />
    <MoodEntriesSection refreshKey={entryVersion} />
  </Page>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  heading: { flex: 1 },
});
