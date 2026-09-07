/**
 * A "click to share" WhatsApp link. Opens WhatsApp (mobile app or web/desktop)
 * with `text` pre-filled and lets the sender pick a chat — typically the club's
 * parents group or a saved broadcast list. WhatsApp has no multi-recipient
 * link, so a group / broadcast list is the delivery target.
 */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
