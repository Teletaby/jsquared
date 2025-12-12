'use client';

import { useSession, signOut } from 'next-auth/react';

export function useAuth() {
  const { data: session, status } = useSession();

  const logout = async () => {
    await signOut({ redirect: true, callbackUrl: '/' });
  };

  return {
    user: session?.user || null,
    loading: status === 'loading',
    authenticated: status === 'authenticated',
    logout,
  };
}
