import Link from 'next/link';
import { featureStrings } from '@/lib/strings/features';
import styles from './FitnessTrackerScreen.module.css';

export function FitnessTrackerScreen() {
  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        {featureStrings.backToFeatures}
      </Link>
      <h1 className={styles.title}>{featureStrings.fitnessTracker.title}</h1>
      <p className={styles.placeholder}>{featureStrings.fitnessTracker.placeholder}</p>
    </main>
  );
}
