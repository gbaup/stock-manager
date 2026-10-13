import { NextResponse } from 'next/server';
import { isMeliAuthorized } from '@/app/lib/meli';
import { getModels } from '@/app/lib/queries';

// Compact model list for n8n's AI fallback: it picks the likeliest model for a
// MELI listing title from these labels, and a human confirms the choice.
export async function GET(request: Request) {
  if (!isMeliAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const models = await getModels();
  return NextResponse.json({
    models: models.map((m) => ({
      id: m.id,
      label: [m.team, m.season, m.version, m.color, m.type, m.sleeve, m.player, m.number && `#${m.number}`]
        .filter(Boolean)
        .join(' '),
      sizes: m.availableBySize.map((s) => s.size),
    })),
  });
}
