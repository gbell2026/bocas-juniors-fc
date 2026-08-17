// This site is run by a single club (Tangerine Toucans) — matching on that
// exact club name identifies which League fixtures are "our" matches versus
// fixtures between two other clubs' teams. Lives in a plain (non-'use
// server') module because Next.js's Server Actions compiler only allows
// async function exports from a 'use server' file — a plain const export
// (as this briefly was, directly in schedule.ts) is a hard build error.
export const HOME_CLUB_NAME = 'Tangerine Toucans'
