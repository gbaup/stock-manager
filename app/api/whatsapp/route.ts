import { NextRequest, NextResponse } from 'next/server';
import { checkWebhook, verifySignature } from '@/app/lib/whatsapp/verify';
import { parseWebhook } from '@/app/lib/whatsapp/parse';
import { handleIncoming } from '@/app/lib/whatsapp/conversation';

// WhatsApp Cloud API webhook. Runs on the default Node runtime (crypto for
// signature verification) — this route talks to the DB and Graph API.

// GET: Meta's subscription handshake. Echo hub.challenge when the verify token
// matches; 403 otherwise.
export async function GET(req: NextRequest) {
  const challenge = checkWebhook(req.nextUrl.searchParams);
  if (challenge === null) return new NextResponse('Forbidden', { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

// POST: inbound messages. Verify the signature over the RAW body, then process.
// Always ack 200 (except on a bad signature) so Meta doesn't retry-storm us on
// an internal error; failures are logged instead.
export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'))) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  try {
    const body = JSON.parse(raw);
    const msg = parseWebhook(body);
    if (msg) await handleIncoming(msg);
  } catch (err) {
    console.error('[whatsapp] webhook handling failed', err);
  }

  return NextResponse.json({ received: true });
}
