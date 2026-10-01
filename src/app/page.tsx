import { features } from '@/lib/features';
import { requireSession } from '@/lib/server/session-cookie';
import { LandingScreen } from './LandingScreen';

export default async function LandingPage() {
  await requireSession('/');
  return <LandingScreen features={features} />;
}
