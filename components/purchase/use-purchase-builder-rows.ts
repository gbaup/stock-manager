'use client';

import { useEffect, useRef } from 'react';

type PurchaseLine = { modelId: string; size: string; basePriceUsd?: string; quantity: number };

// Shared by the new/edit purchase forms on the desktop builder: units per
// model (catalog badges, one-off suggestion) and appending a catalog pick as a
// new row with its size select focused.
export function usePurchaseBuilderRows(
  items: PurchaseLine[],
  rowCount: number,
  append: (line: PurchaseLine) => void,
) {
  const countsById = new Map<string, number>();
  for (const it of items) {
    if (it.modelId) countsById.set(it.modelId, (countsById.get(it.modelId) ?? 0) + (it.quantity ?? 1));
  }

  // Runs only when the row count changes, i.e. right after the append renders.
  const focusRowRef = useRef<number | null>(null);
  useEffect(() => {
    const index = focusRowRef.current;
    if (index === null) return;
    focusRowRef.current = null;
    document.querySelector<HTMLElement>(`[data-prow="${index}"] select`)?.focus();
  }, [rowCount]);

  // A repeated model starts at the price of its last line — usually the same.
  function addModel(modelId: string) {
    const last = [...items].reverse().find((it) => it.modelId === modelId);
    focusRowRef.current = rowCount;
    append({ modelId, size: '', basePriceUsd: last?.basePriceUsd ?? '', quantity: 1 });
  }

  return { countsById, addModel };
}
