'use strict';

// These responses are emitted by NetEase's edge service when a live probe is
// rate-limited or challenged. They are not evidence that the client contract
// or response parser regressed, so the optional live smoke can report them
// separately from deterministic CI gates.
const KNOWN_EXTERNAL_CHALLENGE_CODES = new Set([-462, -460]);
const KNOWN_EXTERNAL_CHALLENGE_HTTP_STATUSES = new Set([403, 429]);

function isKnownExternalChallenge(error) {
  if (!error || typeof error !== 'object') return false;

  if (error.kind === 'business' && KNOWN_EXTERNAL_CHALLENGE_CODES.has(Number(error.code))) {
    return true;
  }

  if (error.kind === 'http' && KNOWN_EXTERNAL_CHALLENGE_HTTP_STATUSES.has(Number(error.httpStatus))) {
    return true;
  }

  return false;
}

function describeExternalChallenge(error) {
  const code = Number.isFinite(Number(error && error.code)) ? `code ${error.code}` : null;
  const status = Number.isFinite(Number(error && error.httpStatus)) ? `HTTP ${error.httpStatus}` : null;
  const signal = code || status || 'unclassified response';
  const message = error && error.message ? `: ${error.message}` : '';
  return `${signal}${message}`;
}

module.exports = {
  KNOWN_EXTERNAL_CHALLENGE_CODES,
  KNOWN_EXTERNAL_CHALLENGE_HTTP_STATUSES,
  isKnownExternalChallenge,
  describeExternalChallenge,
};
