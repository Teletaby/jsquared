'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { useVisitorLogging } from '@/lib/hooks/useVisitorLogging';

function VisitorLogger() {
  useVisitorLogging();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <VisitorLogger />
      {children}
    </SessionProvider>
  );
}
