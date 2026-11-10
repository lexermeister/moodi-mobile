import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { SessionInsightsResponse } from './sessionInsightsTypes';
import type {
  SessionInsightsReviewRequest,
  SessionInsightsReviewResponse,
} from './sessionInsightsReviewTypes';

type EditableItem = {
  itemId: string;
  originalText: string;
  removed: boolean;
  text: string;
};

type Props = {
  insights: SessionInsightsResponse & { draft_id: string };
  review?: SessionInsightsReviewResponse;
  onCancel: () => void;
  onSave: (request: SessionInsightsReviewRequest) => Promise<void>;
};

function initialItems(
  insights: Props['insights'],
  review?: SessionInsightsReviewResponse,
): Record<string, EditableItem> {
  const reviewedItems = new Map(
    review?.draft_id === insights.draft_id
      ? review.sections.flatMap((section) => section.items).map((item) => [item.item_id, item])
      : [],
  );
  const items: Record<string, EditableItem> = {};

  for (const section of insights.result.sections) {
    for (const bullet of section.bullets) {
      if (!bullet.item_id) continue;
      const reviewed = reviewedItems.get(bullet.item_id);
      items[bullet.item_id] = {
        itemId: bullet.item_id,
        originalText: bullet.text,
        removed: reviewed?.disposition === 'removed',
        text: reviewed?.displayed_text ?? bullet.text,
      };
    }
  }
  return items;
}

export function SessionInsightsEditor({ insights, review, onCancel, onSave }: Props) {
  const startingItems = useMemo(
    () => initialItems(insights, review),
    [insights, review],
  );
  const [items, setItems] = useState(startingItems);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDirty = JSON.stringify(items) !== JSON.stringify(startingItems);

  const cancel = () => {
    if (!isDirty) {
      onCancel();
      return;
    }
    Alert.alert('Discard changes?', 'Your unsaved edits will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ]);
  };

  const save = async () => {
    const requestItems: SessionInsightsReviewRequest['items'] = [];
    for (const section of insights.result.sections) {
      for (const bullet of section.bullets) {
        if (!bullet.item_id) continue;
        const item = items[bullet.item_id];
        const text = item.text.trim();
        if (!item.removed && !text) {
          setError('Insight text cannot be empty. Remove the item instead.');
          return;
        }
        requestItems.push({
          item_id: item.itemId,
          disposition: item.removed
            ? 'removed'
            : text === item.originalText
              ? 'retained'
              : 'edited',
          displayed_text: item.removed ? null : text,
        });
      }
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        draft_id: insights.draft_id,
        source_version: insights.source_version,
        items: requestItems,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error && saveError.message
          ? saveError.message
          : 'Reviewed insights could not be saved.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Review your insights</Text>
        <Text style={styles.helpText}>
          Edit the wording or remove anything you do not want to keep.
        </Text>
      </View>

      {insights.result.review_flags.length ? (
        <View style={styles.reviewFlags}>
          <Text style={styles.reviewFlagsTitle}>Please check</Text>
          {insights.result.review_flags.map((flag, index) => (
            <Text key={`${flag.code}-${index}`} style={styles.reviewFlagText}>
              • {flag.detail}
            </Text>
          ))}
        </View>
      ) : null}

      {insights.result.sections.map((section) => (
        <View key={section.key} style={styles.section}>
          <Text style={styles.sectionHeading}>{section.heading}</Text>
          {section.bullets.map((bullet) => {
            if (!bullet.item_id) return null;
            const item = items[bullet.item_id];
            return (
              <View
                key={bullet.item_id}
                style={[styles.item, item.removed && styles.itemRemoved]}>
                {item.removed ? (
                  <>
                    <Text style={styles.removedText}>{item.originalText}</Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isSaving}
                      onPress={() =>
                        setItems((current) => ({
                          ...current,
                          [item.itemId]: { ...current[item.itemId], removed: false },
                        }))
                      }
                      style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}>
                      <Text style={styles.restoreButtonText}>Restore</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <TextInput
                      accessibilityLabel={`Edit ${section.heading} insight`}
                      editable={!isSaving}
                      maxLength={4000}
                      multiline
                      onChangeText={(text) =>
                        setItems((current) => ({
                          ...current,
                          [item.itemId]: { ...current[item.itemId], text },
                        }))
                      }
                      style={styles.input}
                      textAlignVertical="top"
                      value={item.text}
                    />
                    <Pressable
                      accessibilityLabel="Remove this insight"
                      accessibilityRole="button"
                      disabled={isSaving}
                      onPress={() =>
                        setItems((current) => ({
                          ...current,
                          [item.itemId]: { ...current[item.itemId], removed: true },
                        }))
                      }
                      style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}
        </View>
      ))}

      {error ? (
        <Text accessibilityLiveRegion="assertive" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={cancel}
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={() => void save()}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.pressed,
            isSaving && styles.disabled,
          ]}>
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save reviewed insights'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const colors = {
  ink: '#1e2421',
  muted: '#68716b',
  accentDark: '#ca3d28',
  line: '#dcd3c5',
};

const styles = StyleSheet.create({
  container: { gap: 16 },
  header: { gap: 4 },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  helpText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  reviewFlags: { backgroundColor: '#fff8e8', borderRadius: 10, gap: 4, padding: 10 },
  reviewFlagsTitle: { color: '#725d36', fontSize: 12, fontWeight: '800' },
  reviewFlagText: { color: '#725d36', fontSize: 12, lineHeight: 17 },
  section: { gap: 8 },
  sectionHeading: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  item: {
    backgroundColor: '#fffdf8',
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    gap: 7,
    padding: 10,
  },
  itemRemoved: { opacity: 0.72 },
  input: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    minHeight: 64,
    padding: 0,
  },
  removedText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textDecorationLine: 'line-through',
  },
  removeButton: { alignSelf: 'flex-start', paddingVertical: 2 },
  removeButtonText: { color: '#982e22', fontSize: 12, fontWeight: '700' },
  restoreButton: { alignSelf: 'flex-start', paddingVertical: 2 },
  restoreButtonText: { color: colors.accentDark, fontSize: 12, fontWeight: '800' },
  error: { color: '#982e22', fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 9 },
  cancelButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  cancelButtonText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.accentDark,
    borderRadius: 11,
    flex: 2,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
});
