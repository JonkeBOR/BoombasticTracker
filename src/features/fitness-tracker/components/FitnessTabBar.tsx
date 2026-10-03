'use client';

import { Dumbbell, House, Layers } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import styles from './FitnessTabBar.module.css';
import { readStringField } from './read-id';

type Tab = 'home' | 'block' | 'workout';

const homeHref = '/fitness-tracker';
const blockHref = '/fitness-tracker/active/block';

function currentTab(pathname: string): Tab {
  if (pathname.startsWith('/fitness-tracker/active/sessions/')) {
    return 'workout';
  }
  if (pathname === '/fitness-tracker/active' || pathname === blockHref) {
    return 'block';
  }
  return 'home';
}

export function FitnessTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(false);
  const current = currentTab(pathname);

  async function openUpcomingSession() {
    setIsOpening(true);
    try {
      const response = await fetch('/api/fitness/active-program/session', { method: 'POST' });
      const body: unknown = await response.json().catch(() => null);
      const sessionId = response.ok ? readStringField(body, 'sessionId') : null;
      router.push(sessionId === null ? blockHref : `/fitness-tracker/active/sessions/${sessionId}`);
    } catch {
      router.push(blockHref);
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <nav className={styles.bar} aria-label={fitnessStrings.tabBar.label}>
      <Link
        className={styles.tab}
        href={homeHref}
        aria-label={fitnessStrings.tabBar.home}
        aria-current={current === 'home' ? 'page' : undefined}
      >
        <House className={styles.icon} aria-hidden="true" />
      </Link>
      <Link
        className={styles.tab}
        href={blockHref}
        aria-label={fitnessStrings.tabBar.block}
        aria-current={current === 'block' ? 'page' : undefined}
      >
        <Layers className={styles.icon} aria-hidden="true" />
      </Link>
      <button
        type="button"
        className={styles.tab}
        aria-label={fitnessStrings.tabBar.workout}
        aria-current={current === 'workout' ? 'page' : undefined}
        disabled={isOpening}
        onClick={() => void openUpcomingSession()}
      >
        <Dumbbell className={styles.icon} aria-hidden="true" />
      </button>
    </nav>
  );
}
