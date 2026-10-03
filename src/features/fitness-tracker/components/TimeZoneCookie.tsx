'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const cookieName = 'tz';
const oneYearInSeconds = 31536000;

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const entry = document.cookie.split('; ').find((candidate) => candidate.startsWith(prefix));
  return entry === undefined ? null : entry.slice(prefix.length);
}

export function TimeZoneCookie() {
  const router = useRouter();

  useEffect(() => {
    const deviceZone = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (readCookie(cookieName) === deviceZone) {
      return;
    }
    document.cookie = `${cookieName}=${deviceZone}; Path=/; Max-Age=${oneYearInSeconds}; SameSite=Lax`;
    router.refresh();
  }, [router]);

  return null;
}
