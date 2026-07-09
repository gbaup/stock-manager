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
