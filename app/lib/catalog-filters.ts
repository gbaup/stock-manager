import { ITEM_TYPES, sizesForType } from './domain';

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
