import crypto from 'crypto';

// Webhook verification helpers for the Meta WhatsApp Cloud API.

// GET handshake: Meta calls the webhook with hub.mode/hub.verify_token/
// hub.challenge. Echo the challenge back only when the token matches ours.
export function checkWebhook(params: URLSearchParams): string | null {
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

// POST authenticity: Meta signs the raw request body with the app secret and
// sends it as `x-hub-signature-256: sha256=<hex>`. Recompute and compare in
// constant time. If no app secret is configured, skip (dev convenience).
export function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = signatureHeader.slice('sha256='.length);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(received, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
