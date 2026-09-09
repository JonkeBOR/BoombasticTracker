import { appStrings } from '@/lib/strings/app';
import styles from './page.module.css';

export default function LandingPage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{appStrings.name}</h1>
      <p className={styles.description}>{appStrings.description}</p>
    </main>
  );
}
