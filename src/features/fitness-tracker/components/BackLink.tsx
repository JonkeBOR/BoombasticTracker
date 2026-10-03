import Link from 'next/link';
import styles from './BackLink.module.css';

type BackLinkProps = { href: string; label: string };

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link className={styles.back} href={href}>
      {label}
    </Link>
  );
}
