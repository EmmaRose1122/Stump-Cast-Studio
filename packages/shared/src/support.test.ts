import { describe, expect, it } from 'vitest';
import { WHATSAPP_NUMBER, whatsappUrl } from './support';

describe('whatsapp links', () => {
  it('uses a dialable number with no plus sign', () => {
    expect(WHATSAPP_NUMBER).toMatch(/^\d{10,15}$/);
  });

  it('addresses the chat to the seller and encodes the message', () => {
    expect(whatsappUrl('Hi & bye')).toBe(`https://wa.me/${WHATSAPP_NUMBER}?text=Hi%20%26%20bye`);
  });

  it('carries a multi-line machine ID safely', () => {
    const url = whatsappUrl('ID:\nSC-1234');
    expect(url.startsWith(`https://wa.me/${WHATSAPP_NUMBER}?text=`)).toBe(true);
    expect(url).not.toMatch(/\s/);
  });
});
