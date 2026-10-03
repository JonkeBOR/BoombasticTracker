import type { ReactNode } from 'react';
import { TimeZoneCookie } from '@/features/fitness-tracker/components/TimeZoneCookie';

type FitnessTrackerLayoutProps = { children: ReactNode };

export default function FitnessTrackerLayout({ children }: FitnessTrackerLayoutProps) {
  return (
    <>
      <TimeZoneCookie />
      {children}
    </>
  );
}
