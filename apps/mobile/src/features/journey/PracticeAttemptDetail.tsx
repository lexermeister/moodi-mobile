import { Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PracticeIcon } from '@/ui/PracticeIcon';
import { PracticeButton, PracticeSummary, practiceStyles } from '../actions/PracticeUI';
import type { PracticeAttempt } from '../actions/practiceTypes';
import { practiceLogTime } from '../actions/practiceFlowDomain';

export function PracticeAttemptDetail({ attempt, onClose, onEdit }: {
  attempt: PracticeAttempt; onClose: () => void; onEdit: () => void;
}) {
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#16131B99' }}>
      <View style={{ alignSelf: 'center', width: '100%', maxWidth: 420, maxHeight: '92%', backgroundColor: '#24222B', borderRadius: 22, padding: 16, gap: 14 }}>
        <PracticeIcon /><Text accessibilityRole="header" style={practiceStyles.title}>Relaxation / breathing practice</Text>
        <ScrollView><PracticeSummary data={attempt} loggedAt={practiceLogTime(attempt)} /></ScrollView>
        <PracticeButton label="Edit outcome" secondary onPress={onEdit} />
        <PracticeButton label="Done ✓" onPress={onClose} />
      </View>
    </SafeAreaView>
  </Modal>;
}
