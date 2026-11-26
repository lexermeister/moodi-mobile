import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Alert } from '../src/ui/alert.web.ts';

afterEach(() => { delete globalThis.window; });

test('canceling a browser confirmation never invokes its destructive action', () => {
  let deleted = false;
  let canceled = false;
  globalThis.window = { confirm: () => false };
  Alert.alert('Delete recording?', 'Permanent removal', [
    { text: 'Cancel', style: 'cancel', onPress: () => { canceled = true; } },
    { text: 'Delete', style: 'destructive', onPress: () => { deleted = true; } },
  ]);
  assert.equal(deleted, false);
  assert.equal(canceled, true);
});

test('accepting a browser discard confirmation invokes its action once', () => {
  let discarded = 0;
  globalThis.window = { confirm: () => true };
  Alert.alert('Discard changes?', 'Unsaved edits will be lost', [
    { text: 'Keep editing', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: () => { discarded++; } },
  ]);
  assert.equal(discarded, 1);
});

test('informational browser alerts include their title and message', () => {
  let shown;
  globalThis.window = { alert: text => { shown = text; } };
  Alert.alert('Microphone permission', 'Allow access in site settings.');
  assert.deepEqual(shown.split(String.fromCharCode(10)), ['Microphone permission', '', 'Allow access in site settings.']);
});
