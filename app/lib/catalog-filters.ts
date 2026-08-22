import { ITEM_TYPES, sizesForType, compareSizes, compareVersions, matchesModel, fmtType, fmtVersion, fmtSize } from './domain';
import type { ModelWithStats } from './domain';

type ItemType = typeof ITEM_TYPES[number];

// Deliberate public-catalog display order — a curated subset of ITEM_TYPES.
// Excludes internal-only types (e.g. 'nba'); the ordering is a merchandising
// choice, distinct from the canonical ITEM_TYPES order. Typed against ItemType
// so the list can only ever hold canonical type values.
export const CATALOG_TYPE_ORDER: readonly ItemType[] = ['retro', 'fan', 'player', 'short', 'kidkit'];

type CatalogModel = { type: string | null; version: string | null; sizes: string[] };
type Facets = { types: string[]; sizes: string[]; versions: string[] };

// Canonical values are lowercase and sizes are stored codes; matching stays
// case-insensitive here as a defensive guard, contained in this one module.
const hasSize = (m: CatalogModel, size: string) =>
  m.sizes.some((z) => z.toLowerCase() === size.toLowerCase());

// Which filter chips to show, given the data + current selection. Pure.
export function catalogFilterOptions(
  models: CatalogModel[],
  selected: Pick<Facets, 'types' | 'sizes'>,
): { types: string[]; sizes: string[]; versions: string[]; activeSizes: string[] } {
  const types = CATALOG_TYPE_ORDER.filter((t) =>
    models.some((m) => (m.type ?? '').toLowerCase() === t)
  );

  const versions = [...new Set(models.map((m) => m.version).filter(Boolean) as string[])];

  // Kid sizes only apply to kidkit; show them only when that type is selected,
  // and regular sizes otherwise. Reuses sizesForType so the split lives once.
  const showKid = selected.types.includes('kidkit');
  const showRegular = selected.types.length === 0 || selected.types.some((t) => t !== 'kidkit');
  const candidateSizes = [
    ...(showRegular ? sizesForType(null) : []),
    ...(showKid ? sizesForType('kidkit') : []),
  ];
  const sizes = candidateSizes.filter((s) => models.some((m) => hasSize(m, s)));

  // Only keep selected sizes still visible for the chosen type(s).
  const activeSizes = selected.sizes.filter((s) => sizes.includes(s));

  return { types: [...types], sizes, versions, activeSizes };
}

// Does one model pass the facet filters? Same case rules as the option builder.
export function modelMatchesFacets(model: CatalogModel, selected: Facets): boolean {
  if (selected.types.length > 0 && !selected.types.includes((model.type ?? '').toLowerCase())) return false;
  if (selected.versions.length > 0 && !selected.versions.includes(model.version ?? '')) return false;
  if (selected.sizes.length > 0 && !selected.sizes.some((s) => hasSize(model, s))) return false;
  return true;
}

// ---- "Compartir stock" text generation ----
// Builds a price-free, WhatsApp-pasteable summary of in-stock models matching
// a type/size/search filter. Pure, no React/DOM — lives here (rather than
// domain.ts) so it can reuse modelMatchesFacets without a circular import.

export type ShareStockFilters = { types: string[]; sizes: string[]; query: string };

export type ShareStockBlock = {
  model: ModelWithStats;
  sizeEntries: { size: string; count: number }[];
};

// Team names are stored/rendered lowercase and only capitalized via a CSS
// class elsewhere — plain clipboard text has no CSS, so title-case it here.
const titleCase = (s: string): string => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function shareStockBlocks(
  models: ModelWithStats[],
  filters: ShareStockFilters,
): ShareStockBlock[] {
  return models
    .filter((m) => modelMatchesFacets(m, { types: filters.types, sizes: filters.sizes, versions: [] }))
    .filter((m) => matchesModel(m, filters.query))
    .map((m) => ({
      model: m,
      sizeEntries: m.availableBySize
        .filter((s) => s.count > 0 && (filters.sizes.length === 0 || filters.sizes.includes(s.size)))
        .sort((a, b) => compareSizes(a.size, b.size)),
    }))
    .filter((b) => b.sizeEntries.length > 0)
    .sort((a, b) => a.model.team.localeCompare(b.model.team) || compareVersions(a.model.version, b.model.version));
}

export function shareStockText(blocks: ShareStockBlock[]): string {
  return blocks
    .map(({ model: m, sizeEntries }) => {
      const header = [titleCase(m.team), fmtVersion(m.version), fmtType(m.type)].filter(Boolean).join(' · ');
      const sizesLine = 'Talles disponibles: ' + sizeEntries.map((s) => `${fmtSize(s.size)} (${s.count})`).join(', ');
      return `${header}\n${sizesLine}`;
    })
    .join('\n\n');
}
