'use client';

import { useState, useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  const mq = window.matchMedia('(min-width: 1024px)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getSnapshot() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

function getServerSnapshot() {
  return false;
}

export function useIsDesktop() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Shared by ArrivalForm and ShipmentEditForm: warns before saving a shipment
// that has a shipping cost (rate + weight both set) but no payer chosen, so
// the cost doesn't silently go undiscounted from anyone's balance.
export function useShippingPayerConfirm<T extends { shippingPaidByUserId?: string }>(
  watchedShipUsd: string | null | undefined,
  watchedWeight: string | null | undefined,
  doSubmit: (data: T) => void,
) {
  const hasShip = (parseFloat(watchedShipUsd || '') || 0) > 0 && (parseFloat(watchedWeight || '') || 0) > 0;
  const { showConfirm, requestConfirm, confirm, cancel } = useConfirmGate(doSubmit);

  function onSubmit(data: T) {
    if (hasShip && !data.shippingPaidByUserId) {
      requestConfirm(data);
      return;
    }
    doSubmit(data);
  }

  return { hasShip, onSubmit, showConfirm, confirm, cancel };
}

export function useConfirmGate<T>(doSubmit: (data: T) => void) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<T | null>(null);

  function requestConfirm(data: T) {
    setPendingData(data);
    setShowConfirm(true);
  }

  function confirm() {
    setShowConfirm(false);
    if (pendingData) doSubmit(pendingData);
  }

  function cancel() {
    setShowConfirm(false);
    setPendingData(null);
  }

  return { showConfirm, requestConfirm, confirm, cancel };
}
