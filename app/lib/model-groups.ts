import { matchesModel, type ModelWithStats } from '@/app/lib/domain';

// Shared by the mobile ProductPicker sheet and the desktop purchase catalog.

export const modelLabel = (m: ModelWithStats) => [m.team, m.season, m.number, m.player].filter(Boolean).join(' · ');

export type ModelGroup = { key: string; label: string; items: ModelWithStats[] };

export function groupModelsByTeam(list: ModelWithStats[]): ModelGroup[] {
  const map: Record<string, ModelWithStats[]> = {};
  list.forEach((m) => {
    (map[m.team] = map[m.team] || []).push(m);
  });
  return Object.keys(map)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((team) => ({
      key: 'team-' + team,
      label: team,
      items: map[team].sort((a, b) =>
        ((a.version ?? '') + a.season).localeCompare((b.version ?? '') + b.season, 'es'),
      ),
    }));
}

// Groups by team; with no search, the models already in the batch go first ("En este batch").
export function groupModels(models: ModelWithStats[], q: string, recentIds: string[]): ModelGroup[] {
  if (q.trim()) return groupModelsByTeam(models.filter((m) => matchesModel(m, q)));

  const seen = new Set<string>();
  const recents = recentIds
    .map((id) => models.find((m) => m.id === id))
    .filter((m): m is ModelWithStats => !!m && !seen.has(m.id) && !!seen.add(m.id));
  const rset = new Set(recents.map((m) => m.id));
  const groups: ModelGroup[] = recents.length ? [{ key: 'recent', label: 'En este batch', items: recents }] : [];
  return groups.concat(groupModelsByTeam(models.filter((m) => !rset.has(m.id))));
}
