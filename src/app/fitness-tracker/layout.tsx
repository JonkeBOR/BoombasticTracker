import type { ReactNode } from 'react';
import { FitnessTabBar } from '@/features/fitness-tracker/components/FitnessTabBar';
import { TimeZoneCookie } from '@/features/fitness-tracker/components/TimeZoneCookie';

type FitnessTrackerLayoutProps = { children: ReactNode };

export default function FitnessTrackerLayout({ children }: FitnessTrackerLayoutProps) {
  return (
    <>
      <TimeZoneCookie />
      {children}
      <FitnessTabBar />
    </>
  );
}
