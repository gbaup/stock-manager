import type { ModelMeta } from '@/app/lib/domain';
import { fmtVersion, fmtType, fmtSize } from '@/app/lib/domain';

// All bot copy in one place, Spanish (Rioplatense). Keeps tone consistent and
// makes a future LLM/i18n swap a single-file change.

export const MSG = {
  // Shared
  cancelled: 'Listo, cancelé todo. Escribime cuando quieras. 👋',
  notUnderstood: 'No te entendí. Elegí una opción del menú o escribí *cancelar*.',
  error: 'Uf, se me complicó procesar eso. Probá de nuevo en un rato. 🙏',

  // Admin sale flow
  admin: {
    greet: 'Hola 👋 Vamos a registrar una venta.\nEscribí el *equipo* o *jugador* de la camiseta.',
    noModels: (q: string) =>
      `No encontré modelos con stock que coincidan con "${q}". Probá con otro nombre o escribí *cancelar*.`,
    tooMany: (q: string) =>
      `Hay muchos modelos para "${q}". Afiná la búsqueda (agregá temporada, versión o jugador).`,
    pickModel: 'Elegí el modelo:',
    pickSize: 'Elegí el talle:',
    askQty: (available: number) => `¿Cuántas unidades? (hay ${available} disponibles)`,
    badQty: (available: number) =>
      `Cantidad inválida. Ingresá un número entre 1 y ${available}.`,
    askPrice: 'Precio de venta *por unidad* en pesos (UYU). Ej: 1500',
    badPrice: 'Precio inválido. Ingresá un número mayor a 0. Ej: 1500',
    askDate: '¿Cuándo fue la venta?',
    badDate: 'Fecha inválida. Usá el formato AAAA-MM-DD (ej: 2026-07-01) o tocá *Hoy*.',
    pickMethod: '¿Método de cobro?',
    pickCollector: '¿Quién cobró?',
    confirmTitle: 'Confirmá la venta:',
    saved: (n: number) =>
      `✅ ${n === 1 ? 'Venta registrada' : `${n} ventas registradas`}. ¡Gracias!\nEscribime para cargar otra.`,
    noStock: 'No hay stock suficiente para esa venta. Cancelé la operación.',
  },

  // Public catalog flow
  public: {
    greet:
      'Hola 👋 Soy el asistente de la tienda.\n¿De qué *equipo* buscás camiseta? (escribí el nombre)\n\nEn cualquier momento escribí *persona* para hablar con alguien del equipo.',
    noTeam: (q: string) =>
      `No tengo stock de "${q}" ahora mismo. Probá con otro equipo o escribí *persona* para hablar con alguien.`,
    pickModel: (team: string) => `Esto es lo que tengo de *${team}*:`,
    tooMany: (team: string) =>
      `Tengo varios modelos de *${team}*. Decime jugador, temporada o versión para afinar.`,
    askedHuman:
      'Perfecto 🙌 Le avisé al equipo, en un rato te escriben. Si querés seguir viendo stock, escribí *menu*.',
    outOfSizes: 'Ese modelo se quedó sin stock. Escribí *menu* para ver otros.',
  },
};

// One-line human summary of a model, e.g. "Barcelona 2024/25 · Home · Messi".
export function modelSummary(m: ModelMeta): string {
  return [
    m.team,
    m.season,
    m.version && fmtVersion(m.version),
    m.player,
    m.number && `#${m.number}`,
    m.type && fmtType(m.type),
  ]
    .filter(Boolean)
    .join(' · ');
}

// Short label for an interactive list row (title, ≤24 chars enforced downstream).
export function modelRowTitle(m: ModelMeta): string {
  return [m.season, m.version && fmtVersion(m.version), m.player].filter(Boolean).join(' · ') || m.team;
}

// Sizes as a readable list for public replies, mapping kid sizes to age ranges.
export function sizesLine(sizes: string[]): string {
  return sizes.length ? sizes.map(fmtSize).join(', ') : 'sin talles cargados';
}
