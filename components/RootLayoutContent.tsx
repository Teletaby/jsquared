// j-squared-cinema/components/RootLayoutContent.tsx
'use client';

import { usePathname } from 'next/navigation';
import { ReactNode, useState, useEffect } from 'react';
import Header from './Header';
import Footer from './Footer';
import Chatbot from './Chatbot';
import ConditionalLayout from './ConditionalLayout';
import { Providers } from '@/app/providers';
import MaintenancePage from '@/app/maintenance/page';
import { useSession } from 'next-auth/react';
import LoadingSpinner from './LoadingSpinner'; // Assuming you have a LoadingSpinner component
import { disableConsoleInProduction } from '@/lib/disableConsole';

export default function RootLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isLoadingMaintenanceStatus, setIsLoadingMaintenanceStatus] = useState(true);

  // Disable console in production on mount
  useEffect(() => {
    // Temporarily disabled for debugging
    // disableConsoleInProduction();
  }, []);

  useEffect(() => {
    async function fetchMaintenanceStatus() {
      try {
        const response = await fetch('/api/admin/maintenance');
        if (response.ok) {
          const data = await response.json();
          setIsMaintenanceMode(data.isMaintenanceMode);
        } else {
          console.error('Failed to fetch maintenance status');
        }
      } catch (error) {
        console.error('Error fetching maintenance status:', error);
      } finally {
        setIsLoadingMaintenanceStatus(false);
      }
    }
    fetchMaintenanceStatus();
  }, []);

  const isAdmin = session?.user?.role === 'admin';
  const showMaintenancePage = isMaintenanceMode && !isAdmin;

  if (isLoadingMaintenanceStatus || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <LoadingSpinner />
      </div>
    );
  }

  if (showMaintenancePage) {
    return <MaintenancePage />;
  }

  return (
    <>
      <Header />
      <main className="flex-grow container mx-auto px-4 pt-20">
        <ConditionalLayout>{children}</ConditionalLayout>
      </main>
      <Footer />
      <Chatbot />
    </>
  );
}
