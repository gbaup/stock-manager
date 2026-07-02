import axios from 'axios';
import type { OutgoingReply, ReplyButton, ReplySection } from './types';

// Outbound WhatsApp Cloud API client. Mirrors the axios usage in
// app/lib/exchange-rate.ts. All env vars are read on demand (same convention as
// app/api/image/route.ts) so a missing token fails at send time, not import.

const GRAPH_VERSION = 'v21.0';

function config() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error('WhatsApp env vars missing (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)');
  }
  return {
    url: `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
}

// Low-level POST. `payload` is merged onto the common message envelope.
async function send(to: string, payload: Record<string, unknown>): Promise<void> {
  const { url, headers } = config();
  await axios.post(
    url,
    { messaging_product: 'whatsapp', recipient_type: 'individual', to, ...payload },
    { headers, timeout: 10000 },
  );
}

export function sendText(to: string, body: string): Promise<void> {
  return send(to, { type: 'text', text: { preview_url: false, body } });
}

// Interactive reply buttons — WhatsApp allows at most 3.
export function sendButtons(to: string, body: string, buttons: ReplyButton[]): Promise<void> {
  return send(to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: trunc(b.title, 20) },
        })),
      },
    },
  });
}

// Interactive list — at most 10 rows total across all sections.
export function sendList(
  to: string,
  body: string,
  button: string,
  sections: ReplySection[],
): Promise<void> {
  return send(to, {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: trunc(button, 20),
        sections: sections.map((s) => ({
          ...(s.title ? { title: trunc(s.title, 24) } : {}),
          rows: s.rows.map((r) => ({
            id: r.id,
            title: trunc(r.title, 24),
            ...(r.description ? { description: trunc(r.description, 72) } : {}),
          })),
        })),
      },
    },
  });
}

// Dispatch a flow-produced reply descriptor to the right transport.
export function sendReply(to: string, reply: OutgoingReply): Promise<void> {
  switch (reply.kind) {
    case 'text':
      return sendText(to, reply.body);
    case 'buttons':
      return sendButtons(to, reply.body, reply.buttons);
    case 'list':
      return sendList(to, reply.body, reply.button, reply.sections);
  }
}

// WhatsApp enforces hard length limits on interactive titles/descriptions;
// silently truncate rather than let the Graph API reject the whole message.
function trunc(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
