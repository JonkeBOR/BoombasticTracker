import { Plus } from 'lucide-react';
import Link from 'next/link';
import styles from './AddLink.module.css';

type AddLinkProps = { href: string; label: string };

export function AddLink({ href, label }: AddLinkProps) {
  return (
    <Link className={styles.link} href={href} aria-label={label}>
      <span className={styles.circle}>
        <Plus className={styles.icon} aria-hidden="true" />
      </span>
    </Link>
  );
}
