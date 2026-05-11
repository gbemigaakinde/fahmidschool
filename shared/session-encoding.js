// shared/session-encoding.js
// Pure string utilities for encoding session names in Firestore document IDs.
// No Firebase SDK calls — no changes needed for v9 migration.

export function encodeSession(session) {
  if (!session) return '';
  return session.replace(/\//g, '-');
}

export function decodeSession(encodedSession) {
  if (!encodedSession) return '';
  return encodedSession.replace(/-/g, '/');
}

export function generatePaymentDocId(pupilId, session, term) {
  return `${pupilId}_${encodeSession(session)}_${term}`;
}

export function generateFeeStructureDocId(classId, session, term) {
  return `${classId}_${encodeSession(session)}_${term}`;
}
