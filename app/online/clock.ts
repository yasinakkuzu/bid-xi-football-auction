/**
 * Server-clock helpers.
 *
 * Room deadlines are absolute server timestamps, but the countdown used to be
 * rendered against the local `Date.now()`. A device with a skewed clock (very
 * common on phones) would then show a wrong countdown — either cutting the
 * auction short or hiding that the lot already expired. The API returns
 * `serverTime` with every room read, so the client stores the offset once per
 * poll and renders the timer on the server timeline.
 */

export function clockOffset(serverTime: number | null | undefined, clientNow = Date.now()) {
  return typeof serverTime === 'number' && Number.isFinite(serverTime) ? serverTime - clientNow : 0;
}

export function remainingSeconds(deadline: number | null | undefined, clientNow: number, offset = 0) {
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((deadline - (clientNow + offset)) / 1000));
}
