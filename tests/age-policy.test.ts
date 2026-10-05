import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADULT_AGE,
  CONSENT_POLICY_VERSION,
  MIN_AGE,
  ageBand,
  ageFromBirthYear,
  assessAgeDeclaration,
  consentRecord,
  mayPlay,
  mayPublishToLeaderboard,
  mayUseChat,
  minorRestrictionMessage,
} from '../lib/age-policy.ts';

const REFERENCE = Date.UTC(2026, 0, 15);

test('age is derived from the birth year without storing the birth year itself', () => {
  assert.equal(ageFromBirthYear(2000, new Date(REFERENCE)), 26);
  assert.equal(ageFromBirthYear('1995', new Date(REFERENCE)), 31);
  assert.equal(ageFromBirthYear(2013, new Date(REFERENCE)), 13);
  assert.equal(ageFromBirthYear(undefined, new Date(REFERENCE)), null);
  assert.equal(ageFromBirthYear('', new Date(REFERENCE)), null);
  assert.equal(ageFromBirthYear('abcd', new Date(REFERENCE)), null);
  assert.equal(ageFromBirthYear(1800, new Date(REFERENCE)), null, 'implausible years are rejected');
  assert.equal(ageFromBirthYear(2030, new Date(REFERENCE)), null, 'future years are rejected');
});

test('play, chat and publication thresholds follow the documented policy', () => {
  assert.equal(MIN_AGE, 13);
  assert.equal(ADULT_AGE, 18);
  assert.equal(mayPlay(12), false);
  assert.equal(mayPlay(13), true);
  for (const age of [13, 15, 17]) {
    const band = ageBand(age);
    assert.equal(band, 'minor');
    assert.equal(mayUseChat(band), false);
    assert.equal(mayPublishToLeaderboard(band), false);
  }
  for (const age of [18, 40]) {
    const band = ageBand(age);
    assert.equal(band, 'adult');
    assert.equal(mayUseChat(band), true);
    assert.equal(mayPublishToLeaderboard(band), true);
  }
});

test('unknown ages fail closed for the public surfaces', () => {
  assert.equal(ageBand(null), 'unknown');
  assert.equal(mayPlay(null), false);
  assert.equal(mayUseChat('unknown'), false);
  assert.equal(mayPublishToLeaderboard('unknown'), false);
});

test('an untrusted declaration cannot skip consent or the minimum age', () => {
  const missingConsent = assessAgeDeclaration({ birthYear: 1995 }, REFERENCE);
  assert.equal(missingConsent.ok, false);
  assert.equal(missingConsent.ok === false && missingConsent.code, 'CONSENT_REQUIRED');

  const missingYear = assessAgeDeclaration({ consentAccepted: true }, REFERENCE);
  assert.equal(missingYear.ok, false);
  assert.equal(missingYear.ok === false && missingYear.code, 'AGE_REQUIRED');

  const tooYoung = assessAgeDeclaration({ birthYear: 2016, consentAccepted: true }, REFERENCE);
  assert.equal(tooYoung.ok, false);
  assert.equal(tooYoung.ok === false && tooYoung.code, 'AGE_BELOW_MINIMUM');

  const accepted = assessAgeDeclaration({ birthYear: 2016, consentAccepted: 'yes' }, REFERENCE);
  assert.equal(accepted.ok, false, 'only a real boolean consents');

  const minor = assessAgeDeclaration({ birthYear: 2010, consentAccepted: true }, REFERENCE);
  assert.equal(minor.ok, true);
  assert.equal(minor.ok === true && minor.band, 'minor');
  assert.equal(minor.ok === true && minor.consent.policyVersion, CONSENT_POLICY_VERSION);

  const adult = assessAgeDeclaration({ birthYear: 1990, consentAccepted: true }, REFERENCE);
  assert.equal(adult.ok, true);
  assert.equal(adult.ok === true && adult.band, 'adult');
  assert.equal(adult.ok === true && adult.age, 36);
});

test('the consent record is versioned and timestamped for traceability', () => {
  const record = consentRecord('adult', 1_700_000_000_000);
  assert.deepEqual(record, { policyVersion: CONSENT_POLICY_VERSION, acceptedAt: 1_700_000_000_000, ageBand: 'adult' });
  assert.match(CONSENT_POLICY_VERSION, /^kvkk-\d{4}-\d{2}$/);
  assert.match(minorRestrictionMessage('leaderboard'), /18 yaş/);
  assert.match(minorRestrictionMessage('chat'), /sohbet/);
});
