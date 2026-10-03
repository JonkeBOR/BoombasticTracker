import type { ReactNode } from 'react';
import { BackLink } from './BackLink';
import styles from './Screen.module.css';

type ScreenProps = {
  title: string;
  back: { href: string; label: string } | null;
  action?: ReactNode;
  children: ReactNode;
};

export function Screen({ title, back, action, children }: ScreenProps) {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        {back ? <BackLink href={back.href} label={back.label} /> : null}
        {action ? (
          <div className={styles.titleRow}>
            <h1 className={styles.compactTitle}>{title}</h1>
            {action}
          </div>
        ) : (
          <h1 className={styles.title}>{title}</h1>
        )}
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
