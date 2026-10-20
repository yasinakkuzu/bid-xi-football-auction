import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_HISTORY_LIMIT,
  chatModerationMessage,
  containsBlockedTerm,
  moderateDisplayName,
  moderationMessage,
  normalizeDisplayName,
  sanitizeChatMessage,
} from '../lib/moderation.ts';

test('ordinary manager names pass, including names that contain short blocked tokens', () => {
  for (const name of [
    'Yasin',
    'Yakup',
    'Mehmet',
    'O’Brien',
    'Ayşe Nur',
    'Margot',
    'Picasso',
    'Siklet',
    'Scunthorpe',
    'Zeynep',
    'Şenol Durmuş',
    'Erol Dursun',
    'Birol Durmaz',
    'Gürol Durak',
    'Işık',
  ])
    assert.equal(moderateDisplayName(name).ok, true, name);
});

test('profanity, hate speech and impersonation markers are rejected', () => {
  for (const name of [
    'amk',
    'orospu',
    'siktir',
    'yarrak',
    'serefsiz',
    'gerizekalı',
    'fuck',
    'fucking',
    'bitch',
    'nigger',
    'hitler',
    'terörist',
    'admin',
    'yönetici',
    'Official Destek',
    'amkkk',
    'siiik',
    'oroospu',
    '1sik',
    'öldürürüm',
  ])
    assert.equal(moderateDisplayName(name).ok, false, name);
});

test('separator and character-substitution evasion is normalised before matching', () => {
  for (const name of ['s.i.k', 'a m k', 'SİKTİR', 'fuck3r', 'b1tch', 'n1gger', 'g3riz3kali', 'o.l.d.u.r'])
    assert.equal(containsBlockedTerm(name), true, name);
});

test('empty, over-long and control-character names are reported distinctly', () => {
  assert.deepEqual(moderateDisplayName(''), { ok: false, reason: 'empty' });
  assert.deepEqual(moderateDisplayName('   '), { ok: false, reason: 'empty' });
  assert.deepEqual(moderateDisplayName('a'.repeat(25)), { ok: false, reason: 'too-long' });
  assert.deepEqual(moderateDisplayName('kötü\u0007ad'), { ok: false, reason: 'control-chars' });
  assert.deepEqual(moderateDisplayName('Yasin\u200B'), { ok: false, reason: 'control-chars' });
  assert.deepEqual(moderateDisplayName('Yasin\u202E'), { ok: false, reason: 'control-chars' });
  assert.match(moderationMessage({ ok: false, reason: 'blocked' }), /küfür/);
  assert.match(moderationMessage({ ok: false, reason: 'too-long' }), /24/);
});

test('accepted names are normalised for storage', () => {
  assert.equal(normalizeDisplayName('  Yasin   Akkuzu  '), 'Yasin Akkuzu');
  assert.equal(normalizeDisplayName('x'.repeat(50)).length, 24);
  assert.equal(normalizeDisplayName('a\u0001b'), 'a b');
  assert.equal(normalizeDisplayName('a\u200Bb'), 'a b');
});

test('chat text is stripped, clamped and moderated', () => {
  assert.equal(sanitizeChatMessage('  merhaba  '), 'merhaba');
  assert.equal(sanitizeChatMessage('a'.repeat(300)).length, 200);
  assert.equal(sanitizeChatMessage('satır\u0000başı'), 'satır başı');
  assert.equal(containsBlockedTerm('bu adam çok iyi bir menajer'), false);
  assert.equal(containsBlockedTerm('kadro doldur'), false);
  assert.equal(containsBlockedTerm('gol durumu nedir?'), false);
  assert.equal(containsBlockedTerm('badminton turnuvası'), false);
  assert.equal(containsBlockedTerm('orospu'), true);
  assert.match(chatModerationMessage(), /sohbet/);
  assert.equal(CHAT_HISTORY_LIMIT, 40);
});
