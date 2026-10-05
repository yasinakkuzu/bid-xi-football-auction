/**
 * Display-name and chat moderation.
 *
 * Manager names are user generated content rendered to every room participant
 * and, with explicit consent, published on the public leaderboard. Names are
 * therefore filtered server-side before they are stored.
 *
 * Matching strategy (tuned to avoid the "Scunthorpe problem" while still
 * catching common evasion):
 *
 *   1. The input is split into alphanumeric tokens and each token is normalised
 *      (Turkish casing, diacritics, leetspeak, repeated separators).
 *   2. A term of 1-3 characters must match a token exactly (`sik`, `got`, `pic`),
 *      so `Siklet`, `Margot` and `Picasso` stay usable.
 *   3. A term of 4+ characters also matches at the start of a token
 *      (`Fucker`, `siktirgit`).
 *   4. A term of 5+ characters also matches anywhere in the collapsed string
 *      (`gerizekali123`).
 *   5. The fully collapsed string is compared with the term to catch separator
 *      evasion such as `s.i.k` or `a.m.k`.
 *
 * The list is intentionally short and reviewable. It is a baseline, not a
 * replacement for the reporting and takedown flow described in
 * `docs/data-rights.md`.
 */

const BLOCKED_TERMS = [
  // Turkish profanity and abuse
  'amk',
  'orospu',
  'oruspu',
  'pic',
  'sik',
  'sike',
  'sikim',
  'siktir',
  'yavsak',
  'yarak',
  'yarrak',
  'got',
  'gerizekali',
  'serefsiz',
  'pezevenk',
  'kahpe',
  'fahise',
  'salak',
  // English profanity and abuse
  'fuck',
  'fucker',
  'fucking',
  'faggot',
  'nigger',
  'nigga',
  'retard',
  'whore',
  'bitch',
  'cunt',
  // Hate, threats and impersonation markers
  'hitler',
  'terorist',
  'terrorist',
  'oldur',
  'admin',
  'yonetici',
  'moderator',
  'destek ekibi',
  'official',
  'resmi hesap',
];

/** Reduces common evasion tricks to a canonical form. */
export function normalizeForModeration(value: string) {
  return value
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[4@]/g, 'a')
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/0/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/[^a-z0-9]+/g, '');
}

export function containsBlockedTerm(value: string) {
  const collapsed = normalizeForModeration(value);
  if (!collapsed) return false;
  const withoutTrailingDigits = collapsed.replace(/\d+$/, '');
  const tokens = value
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => normalizeForModeration(token).replace(/\d+$/, ''))
    .filter(Boolean);

  return BLOCKED_TERMS.some((rawTerm) => {
    const term = normalizeForModeration(rawTerm);
    if (!term) return false;
    if (collapsed === term || withoutTrailingDigits === term) return true;
    if (tokens.some((token) => token === term)) return true;
    if (term.length >= 4 && tokens.some((token) => token.startsWith(term))) return true;
    if (term.length >= 5 && collapsed.includes(term)) return true;
    return false;
  });
}

export const DISPLAY_NAME_MAX_LENGTH = 24;
export const CHAT_MESSAGE_MAX_LENGTH = 200;
export const CHAT_HISTORY_LIMIT = 40;

export type ModerationResult = { ok: true } | { ok: false; reason: 'empty' | 'too-long' | 'blocked' | 'control-chars' };

export function moderateDisplayName(raw: unknown, maxLength = DISPLAY_NAME_MAX_LENGTH): ModerationResult {
  const value = typeof raw === 'string' ? raw : '';
  if (/[\u0000-\u001f\u007f]/.test(value)) return { ok: false, reason: 'control-chars' };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (trimmed.length > maxLength) return { ok: false, reason: 'too-long' };
  if (containsBlockedTerm(trimmed)) return { ok: false, reason: 'blocked' };
  return { ok: true };
}

/** Normalises an accepted display name for storage. */
export function normalizeDisplayName(raw: unknown, maxLength = DISPLAY_NAME_MAX_LENGTH) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Strips control characters and enforces the chat length budget. */
export function sanitizeChatMessage(raw: unknown, maxLength = CHAT_MESSAGE_MAX_LENGTH) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function moderationMessage(result: Extract<ModerationResult, { ok: false }>) {
  switch (result.reason) {
    case 'control-chars':
      return 'Görünen ad geçersiz karakterler içeriyor.';
    case 'too-long':
      return `Görünen ad en fazla ${DISPLAY_NAME_MAX_LENGTH} karakter olabilir.`;
    case 'blocked':
      return 'Bu görünen ad kullanılamaz. Lütfen küfür, hakaret veya resmî unvan içermeyen bir ad seçin.';
    default:
      return 'Görünen ad gerekli.';
  }
}

export function chatModerationMessage() {
  return 'Mesaj gönderilemedi: küfür, hakaret veya tehdit içeren ifadeler sohbette paylaşılamaz.';
}
