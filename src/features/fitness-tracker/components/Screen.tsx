import type { ReactNode } from 'react';
import { BackLink } from './BackLink';
import styles from './Screen.module.css';

type ScreenProps = {
  title: string;
  back: { href: string; label: string } | null;
  children: ReactNode;
};

export function Screen({ title, back, children }: ScreenProps) {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        {back ? <BackLink href={back.href} label={back.label} /> : null}
        <h1 className={styles.title}>{title}</h1>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
