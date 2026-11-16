import { Text, View } from 'react-native';
import { useState } from 'react';
import { Button, Card, Page, typography } from '@/ui/components';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { useMoodiPanel } from './MoodiPanel';
import { RecentMoodChart } from './RecentMoodChart';
import { TodayMoodActions } from '../actions/TodayMoodActions';

export function MoodiScreen() {
  const [entryVersion, setEntryVersion] = useState(0);
  const { setOpen } = useMoodiPanel();
  const library = useSharedRecordingLibrary();
  return <Page>
    <View><Text style={typography.body}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      <Text style={typography.title}>Today</Text></View>
    <Text style={typography.heading}>To do</Text>
    <TodayMoodActions onEntriesChanged={() => setEntryVersion(value => value + 1)} />
    <Card><Text style={typography.heading}>{library.isRecording ? 'Session in progress' : 'A space for your session'}</Text>
      <Text style={typography.body}>{library.isRecording ? 'Open Moodi to see your recording.' : 'When you’re ready, open Moodi to record a session.'}</Text>
      <Button label={library.isRecording ? 'Open recording' : 'Open Moodi'} onPress={() => setOpen(true)} /></Card>
    <RecentMoodChart key={entryVersion} />
  </Page>;
}
