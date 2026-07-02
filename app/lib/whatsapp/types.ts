// Types for the WhatsApp Cloud API webhook + the bot's conversation state.
// Kept deliberately narrow: only the fields the bot actually reads.

// ---- Inbound: normalized message the flows work with ----

// Everything the state machine needs from an incoming WhatsApp message, after
// the raw webhook payload has been flattened. `text` is the typed body (or the
// title of a tapped interactive reply); `replyId` is the id of a tapped
// button/list row (our own ids, e.g. "size:M"). One of them is usually set.
export type IncomingMessage = {
  from: string; // sender wa_id (E.164 digits, no '+')
  messageId: string;
  text: string; // trimmed; '' when there's no textual content
  replyId: string | null; // interactive button/list reply id, if any
};

// ---- Outbound: reply descriptors the client knows how to send ----

export type ReplyButton = { id: string; title: string };
export type ReplyRow = { id: string; title: string; description?: string };
export type ReplySection = { title?: string; rows: ReplyRow[] };

export type OutgoingReply =
  | { kind: 'text'; body: string }
  | { kind: 'buttons'; body: string; buttons: ReplyButton[] } // max 3
  | { kind: 'list'; body: string; button: string; sections: ReplySection[] }; // rows max 10 total

// ---- Conversation state (persisted in the BotConversation table) ----

export type Role = 'admin' | 'public';

// A sale being assembled step by step, mirroring the web sale form fields.
export type SaleDraft = {
  modelId?: string;
  modelLabel?: string; // human summary for the confirmation screen
  size?: string;
  quantity?: string;
  price?: string;
  date?: string; // YYYY-MM-DD
  method?: string; // canonical METHODS value, or omitted
  collectedByUserId?: string;
};

// The public catalog query context (last team searched, selected model).
export type PublicQuery = {
  team?: string;
  modelId?: string;
};

export type ConversationData = { sale?: SaleDraft; query?: PublicQuery };

// What every step handler returns: where to go next, the data to persist, and
// the messages to send. Pure — no I/O — so it stays trivially testable and an
// LLM interpreter can be swapped in without touching the transition logic.
export type StepResult = {
  step: string;
  data: ConversationData;
  replies: OutgoingReply[];
};
