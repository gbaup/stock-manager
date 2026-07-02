import { getPublicModels } from '@/app/lib/queries';
import { matchesModel } from '@/app/lib/domain';
import type { ConversationData, IncomingMessage, StepResult } from '../types';
import { MSG, modelSummary, modelRowTitle, sizesLine } from '../messages';

// Read-only catalog browsing for public customers: search a team → pick a model
// → see available sizes. "Hablar con una persona" (handoff) is handled globally
// in the orchestrator. Only in-stock models are ever exposed (getPublicModels).

const MAX_LIST = 10;

export async function publicStockStep(
  step: string,
  data: ConversationData,
  msg: IncomingMessage,
): Promise<StepResult> {
  const query = data.query ?? {};

  switch (step) {
    case 'start':
      return { step: 'browse', data: { query: {} }, replies: [{ kind: 'text', body: MSG.public.greet }] };

    case 'browse': {
      // Tapped a model → show its available sizes + next-step buttons.
      const picked = id(msg.replyId, 'pubmodel');
      if (picked) {
        const { models } = await getPublicModels();
        const model = models.find((m) => m.id === picked);
        if (!model) return { step: 'browse', data, replies: [{ kind: 'text', body: MSG.public.outOfSizes }] };
        return {
          step: 'browse',
          data: { query: { ...query, modelId: model.id } },
          replies: [
            {
              kind: 'buttons',
              body: `👕 ${modelSummary(model)}\n📏 Talles: ${sizesLine(model.sizes)}`,
              buttons: [
                { id: 'newteam', title: 'Ver otro equipo' },
                { id: 'human', title: 'Hablar con alguien' },
              ],
            },
          ],
        };
      }

      // "Ver otro equipo" → re-prompt for a team name.
      if (msg.replyId === 'newteam') {
        return { step: 'browse', data: { query: {} }, replies: [{ kind: 'text', body: MSG.public.greet }] };
      }

      // Otherwise treat the text as a team search.
      const q = msg.text;
      if (!q) return { step: 'browse', data, replies: [{ kind: 'text', body: MSG.public.greet }] };
      const { models } = await getPublicModels();
      const matches = models.filter((m) => matchesModel(m, q));
      if (matches.length === 0) return { step: 'browse', data, replies: [{ kind: 'text', body: MSG.public.noTeam(q) }] };

      const teamLabel = matches[0].team;
      if (matches.length > MAX_LIST) {
        return { step: 'browse', data: { query: { ...query, team: q } }, replies: [{ kind: 'text', body: MSG.public.tooMany(teamLabel) }] };
      }
      return {
        step: 'browse',
        data: { query: { ...query, team: q } },
        replies: [
          {
            kind: 'list',
            body: MSG.public.pickModel(teamLabel),
            button: 'Ver modelos',
            sections: [
              {
                rows: matches.map((m) => ({
                  id: `pubmodel:${m.id}`,
                  title: modelRowTitle(m),
                  description: `Talles: ${sizesLine(m.sizes)}`,
                })),
              },
            ],
          },
        ],
      };
    }

    case 'handoff':
      // Bot stays silent while a human handles it; "menu"/"cancelar" (global) resets.
      return { step: 'handoff', data, replies: [] };

    default:
      return { step: 'browse', data: { query: {} }, replies: [{ kind: 'text', body: MSG.public.greet }] };
  }
}

function id(replyId: string | null, prefix: string): string | null {
  if (!replyId) return null;
  const p = `${prefix}:`;
  return replyId.startsWith(p) ? replyId.slice(p.length) : null;
}
