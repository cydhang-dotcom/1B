import { useMemo } from 'react';

export function useShareUserUuid(): string | null {
  return useMemo(
    () => new URLSearchParams(window.location.search).get('shareUserUuid'),
    [],
  );
}

export function appendShareUserUuid(href: string, uuid: string | null): string {
  if (!uuid) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}shareUserUuid=${encodeURIComponent(uuid)}`;
}
