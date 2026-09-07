/**
 * Resend "from" address for outbound mail.
 *
 * The default `onboarding@resend.dev` is Resend's shared sandbox sender — it
 * only delivers to the Resend account owner's own address. To email parents
 * for real, verify a domain in Resend (e.g. tangerine.international) and set
 * RESEND_FROM to an address on it, like:
 *   RESEND_FROM="Tangerine Toucans FC <news@tangerine.international>"
 */
export const RESEND_FROM =
  process.env.RESEND_FROM ?? 'Tangerine Toucans <onboarding@resend.dev>'
