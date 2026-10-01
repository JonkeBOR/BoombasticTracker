import Link from 'next/link';
import type { Feature } from '@/lib/features';
import { appStrings } from '@/lib/strings/app';
import { authStrings } from '@/lib/strings/auth';
import { featureStrings } from '@/lib/strings/features';
import styles from './LandingScreen.module.css';

type LandingScreenProps = {
  features: readonly Feature[];
};

const featureHeadingId = 'feature-heading';

export function LandingScreen({ features }: LandingScreenProps) {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{appStrings.name}</h1>
      <p className={styles.description}>{appStrings.description}</p>
      <h2 className={styles.featureHeading} id={featureHeadingId}>
        {featureStrings.heading}
      </h2>
      <ul className={styles.features} aria-labelledby={featureHeadingId}>
        {features.map((feature) => (
          <li key={feature.id}>
            <Link className={styles.featureCard} href={feature.path}>
              <span className={styles.featureTitle}>{feature.title}</span>
              <span className={styles.featureDescription}>{feature.description}</span>
            </Link>
          </li>
        ))}
      </ul>
      <form className={styles.signOutForm} method="post" action="/api/auth/sign-out">
        <button className={styles.signOut} type="submit">
          {authStrings.signOut}
        </button>
      </form>
    </main>
  );
}
