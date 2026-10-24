/**
 * The seller's WhatsApp number, digits only (country code first, no `+`), which is the form `wa.me`
 * expects.
 *
 * It lives here so every "Go Pro" path — the look modal, the header, the licence dialog, the
 * overlay's ad — reaches the same person. The number itself is never printed in a button label;
 * only the link carries it.
 */
export const WHATSAPP_NUMBER = '923004531248';

/** A `wa.me` deep link that opens a chat with the seller and pre-fills `text`. */
export const whatsappUrl = (text: string): string =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
