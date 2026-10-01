import { redirect } from 'next/navigation';
import { safeReturnTo } from '@/lib/return-to';
import { getSession } from '@/lib/server/session-cookie';
import { parseSignInError } from '@/lib/sign-in-error';
import { SignInScreen } from './SignInScreen';

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { returnTo, error } = await searchParams;
  const safeReturnPath = safeReturnTo(returnTo);

  if (await getSession()) {
    redirect(safeReturnPath);
  }

  return <SignInScreen returnTo={safeReturnPath} error={parseSignInError(error)} />;
}
