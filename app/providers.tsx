'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { useVisitorLogging } from '@/lib/hooks/useVisitorLogging';
import { useEffect } from 'react';
import { disableConsoleInProduction } from '@/lib/disableConsole';

function VisitorLogger() {
  useVisitorLogging();
  return null;
}

function DevToolsBlocker() {
  useEffect(() => {
    disableConsoleInProduction();
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <VisitorLogger />
      <DevToolsBlocker />
      {children}
    </SessionProvider>
  );
}
