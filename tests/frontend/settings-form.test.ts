import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSaveBody,
  buildTestBody,
  draftFromSnapshot,
  draftStamp,
  isDirty,
  keyLabel,
  messageForError,
  validateDraft
} from '../../frontend/src/settings-form.ts';
import type { AiSettingsSnapshot } from '../../frontend/src/types.ts';
import { parseTimeout, validateBaseUrl } from '../../frontend/src/validate.ts';

function snapshot(patch: Partial<AiSettingsSnapshot> = {}): AiSettingsSnapshot {
  return {
    config_revision: 3,
    settings: {
      mode: 'real',
      base_url: 'https://api.openai.com/v1',
      model: 'demo-model',
      auth_mode: 'bearer',
      timeout_seconds: 30
    },
    key_present: true,
    key_source: 'runtime',
    locked_fields: [],
    status: 'configured',
    ...patch
  };
}

test('base URL rejects secrets, query, fragment, completions and private hosts', () => {
  assert.equal(validateBaseUrl('https://api.openai.com/v1/').ok, true);
  assert.equal(validateBaseUrl('https://user:secret@api.openai.com/v1').ok, false);
  assert.equal(validateBaseUrl('https://api.openai.com/v1?key=1').ok, false);
  assert.equal(validateBaseUrl('https://api.openai.com/v1#frag').ok, false);
  assert.equal(validateBaseUrl('https://api.openai.com/v1/chat/completions').ok, false);
  assert.equal(validateBaseUrl('http://192.168.1.8/v1').ok, false);
  assert.equal(validateBaseUrl('http://169.254.169.254/').ok, false);
  assert.equal(validateBaseUrl('http://127.0.0.1:8000/v1').ok, true);
  const normalized = validateBaseUrl('https://api.openai.com/v1/');
  assert.equal(normalized.ok && normalized.normalized, 'https://api.openai.com/v1');
});

test('timeout accepts only whole seconds from 5 to 120', () => {
  assert.equal(parseTimeout('30'), 30);
  assert.equal(parseTimeout('5'), 5);
  assert.equal(parseTimeout('120'), 120);
  assert.equal(parseTimeout('4'), null);
  assert.equal(parseTimeout('121'), null);
  assert.equal(parseTimeout('30.5'), null);
  assert.equal(parseTimeout('05'), null);
  assert.equal(parseTimeout('1e1'), null);
  assert.equal(parseTimeout('NaN'), null);
});

test('save body uses numbers and booleans and omits an empty key', () => {
  const saved = snapshot();
  const draft = draftFromSnapshot(saved);
  draft.timeoutText = '45';
  draft.clearRuntimeKey = true;
  const body = buildSaveBody(draft, saved);
  assert.ok(body);
  assert.equal(body.settings.timeout_seconds, 45);
  assert.equal(typeof body.settings.timeout_seconds, 'number');
  assert.equal(body.clear_api_key, true);
  assert.equal(typeof body.clear_api_key, 'boolean');
  assert.equal('api_key' in body, false);
  assert.equal(JSON.stringify(body).includes('sk-'), false);
});

test('a typed key is sent once and is not copied into the draft stamp store', () => {
  const saved = snapshot();
  const draft = draftFromSnapshot(saved);
  draft.apiKeyInput = 'sk-test-value';
  const body = buildSaveBody(draft, saved);
  assert.equal(body?.api_key, 'sk-test-value');
  assert.equal(draftStamp(draft).includes('sk-test-value'), false);
  assert.equal(draftStamp(draft).includes('hasTypedKey'), true);
});

test('replace and clear together is rejected', () => {
  const saved = snapshot();
  const draft = draftFromSnapshot(saved);
  draft.apiKeyInput = 'sk-test-value';
  draft.clearRuntimeKey = true;
  assert.ok(validateDraft(draft, saved).api_key);
  assert.equal(buildSaveBody(draft, saved), null);
});

test('changing the server does not keep the old key label', () => {
  const saved = snapshot();
  const draft = draftFromSnapshot(saved);
  draft.baseUrl = 'https://example.test/v1';
  assert.match(keyLabel(saved, draft), /Not set for this server/);
  assert.equal(buildSaveBody(draft, saved)?.api_key, undefined);
});

test('demo mode builds no test request', () => {
  const saved = snapshot();
  const draft = draftFromSnapshot(saved);
  draft.mode = 'demo';
  assert.equal(buildTestBody(draft, saved), null);
  const save = buildSaveBody(draft, saved);
  assert.equal(save?.settings.mode, 'demo');
});

test('any field change produces a new stamp and a dirty draft', () => {
  const saved = snapshot();
  const draft = draftFromSnapshot(saved);
  const before = draftStamp(draft);
  assert.equal(isDirty(draft, saved), false);
  draft.model = 'other-model';
  assert.notEqual(draftStamp(draft), before);
  assert.equal(isDirty(draft, saved), true);
});

test('conflict and missing settings service keep a usable message', () => {
  const conflict = new Error('Settings changed on the server. Your draft is kept. Load the saved configuration, then try again.');
  Object.assign(conflict, { status: 409, code: 'CONFIG_CONFLICT' });
  assert.match(messageForError(conflict), /draft is kept/);
  const missing = new Error('not found');
  Object.assign(missing, { status: 404, code: 'INTERNAL_ERROR' });
  assert.match(messageForError(missing), /not available yet/);
});

test('an environment key cannot be cleared and locked fields stay unchanged', () => {
  const saved = snapshot({
    key_source: 'environment',
    key_present: true,
    locked_fields: ['base_url']
  });
  const draft = draftFromSnapshot(saved);
  draft.clearRuntimeKey = true;
  draft.baseUrl = 'https://evil.example/v1';
  assert.match(validateDraft(draft, saved).api_key ?? '', /cannot be cleared/);
  draft.clearRuntimeKey = false;
  const body = buildSaveBody(draft, saved);
  assert.equal(body?.settings.base_url, 'https://api.openai.com/v1');
});
