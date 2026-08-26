/**
 * Remove every PW-VERIFY record the run created, whether it passed or failed.
 *
 * The CRUD spec deletes its Deal through the UI — that is an assertion, not housekeeping. This is the
 * housekeeping: it runs unconditionally so a failed run does not poison the next one, and it deletes
 * child-first so the S1 foreign keys never block it. See lib/cleanup.mjs for why it is SQL.
 */
export default async function globalTeardown(): Promise<void> {
  const { cleanup } = await import('./cleanup.mjs');
  cleanup();
}
