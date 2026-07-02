import { prisma } from '@/app/lib/prisma';
import type { ConversationData, IncomingMessage, Role, StepResult } from './types';
import { adminSaleStep } from './flows/admin-sale';
import { publicStockStep } from './flows/public-stock';
import { sendReply, sendText } from './client';
import { MSG } from './messages';

// Orchestrates one inbound WhatsApp message end to end:
// load state → dedupe → resolve role → global commands → dispatch flow →
// persist → send replies. The step handlers themselves are (near-)pure; all
// I/O and persistence live here.

const RESET_WORDS = new Set(['cancelar', 'cancel', 'menu', 'menú', 'salir', 'reiniciar']);
const HUMAN_WORDS = ['persona', 'humano', 'human', 'ayuda', 'hablar con alguien', 'hablar con una persona'];

export async function handleIncoming(msg: IncomingMessage): Promise<void> {
  const existing = await prisma.botConversation.findUnique({ where: { phone: msg.from } });

  // Ignore Meta webhook retries of a message we already processed.
  if (existing && existing.lastMessageId === msg.messageId) return;

  const { role, userId } = await resolveRole(msg.from);
  const step = existing?.step ?? 'start';
  const data = (existing?.data as ConversationData | null) ?? {};

  const result = await route({ msg, role, userId, step, data });

  await prisma.botConversation.upsert({
    where: { phone: msg.from },
    create: { phone: msg.from, role, step: result.step, data: result.data, lastMessageId: msg.messageId },
    update: { role, step: result.step, data: result.data, lastMessageId: msg.messageId },
  });

  for (const reply of result.replies) {
    await sendReply(msg.from, reply);
  }
}

// Global commands first, then the role-specific flow.
async function route(input: {
  msg: IncomingMessage;
  role: Role;
  userId: string | null;
  step: string;
  data: ConversationData;
}): Promise<StepResult> {
  const { msg, role, userId, step, data } = input;
  const text = msg.text.toLowerCase().trim();

  // Reset from anywhere → restart the relevant flow immediately.
  if (RESET_WORDS.has(text)) {
    return dispatch(role, userId, 'start', {}, msg);
  }

  // Public "talk to a human" → notify admins, then go quiet until reset.
  if (role === 'public' && (msg.replyId === 'human' || HUMAN_WORDS.some((w) => text.includes(w)))) {
    await notifyAdmins(msg.from);
    return { step: 'handoff', data, replies: [{ kind: 'text', body: MSG.public.askedHuman }] };
  }

  return dispatch(role, userId, step, data, msg);
}

function dispatch(role: Role, userId: string | null, step: string, data: ConversationData, msg: IncomingMessage): Promise<StepResult> {
  return role === 'admin' && userId
    ? adminSaleStep(step, data, msg, userId)
    : publicStockStep(step, data, msg);
}

async function resolveRole(phone: string): Promise<{ role: Role; userId: string | null }> {
  const user = await prisma.user.findUnique({ where: { phoneNumber: phone }, select: { id: true } });
  return user ? { role: 'admin', userId: user.id } : { role: 'public', userId: null };
}

async function notifyAdmins(customerPhone: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { phoneNumber: { not: null } },
    select: { phoneNumber: true },
  });
  const body = `📩 Un cliente (+${customerPhone}) pidió hablar con una persona por WhatsApp.`;
  await Promise.allSettled(admins.map((a) => (a.phoneNumber ? sendText(a.phoneNumber, body) : Promise.resolve())));
}
