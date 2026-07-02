import type { IncomingMessage } from './types';

// Flatten a WhatsApp Cloud API webhook payload into our normalized message.
// The payload nests messages under entry[].changes[].value.messages[]; status
// callbacks (delivered/read) carry no `messages` array and yield null so the
// route can ack them without running a flow.
//
// Isolating extraction here is the "parseInput" seam from the plan: to add an
// LLM interpreter later, enrich the IncomingMessage here without touching flows.
export function parseWebhook(body: unknown): IncomingMessage | null {
  const value = (body as WebhookBody)?.entry?.[0]?.changes?.[0]?.value;
  const msg = value?.messages?.[0];
  if (!msg?.from || !msg.id) return null;

  if (msg.type === 'interactive') {
    const reply = msg.interactive?.button_reply ?? msg.interactive?.list_reply;
    return {
      from: msg.from,
      messageId: msg.id,
      text: (reply?.title ?? '').trim(),
      replyId: reply?.id ?? null,
    };
  }

  // Plain text (and a best-effort fallback for button-template taps).
  const text = msg.text?.body ?? msg.button?.text ?? '';
  return { from: msg.from, messageId: msg.id, text: text.trim(), replyId: null };
}

// Minimal shape of the fields we read from the webhook payload.
type WebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          id?: string;
          type?: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: {
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string };
          };
        }>;
      };
    }>;
  }>;
};
