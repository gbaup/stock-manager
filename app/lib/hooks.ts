'use client';

import { useSyncExternalStore } from 'react';

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
