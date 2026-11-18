import { StyleSheet, Text, View } from 'react-native';
import { Page, typography } from '@/ui/components';
import { useMoodiPanel } from './MoodiPanel';
import { RecentMoodChart } from './RecentMoodChart';
import { TodayMoodActions } from '../actions/TodayMoodActions';
import { MoodEntriesSection } from '../actions/MoodEntriesSection';
import { DemoResetButton } from './DemoResetButton';
import { ReviewSessionTodo } from './ReviewSessionTodo';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { TodoRow } from '@/ui/TodoRow';

export function MoodiScreen() {
  const { entryVersion, setOpen } = useMoodiPanel();
  const library = useSharedRecordingLibrary();
  const recordingActive = library.isRecording || library.isStarting;
  return <Page>
    <View style={styles.header}>
      <View style={styles.heading}><Text style={typography.body}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <Text style={typography.title}>Today</Text></View>
      <DemoResetButton />
    </View>
    <View style={styles.todo}><Text style={typography.heading}>To do</Text>
      {recordingActive ? <TodoRow kind="recording" title="Recording session"
        subtitle="Open Moodi to see the session" onPress={() => setOpen(true)} /> : <ReviewSessionTodo />}
      <TodayMoodActions refreshKey={entryVersion} />
    </View>
    <RecentMoodChart key={entryVersion} />
    <MoodEntriesSection refreshKey={entryVersion} />
  </Page>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  heading: { flex: 1 },
  todo: { gap: 9 },
});
