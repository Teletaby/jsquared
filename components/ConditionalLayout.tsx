"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import LoadingSpinner from './LoadingSpinner';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean | null>(null);
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);

  const isSigninPage = pathname === '/signin';
  const isMaintenancePage = pathname === '/maintenance';
  const isAdminPage = pathname === '/admin';

  useEffect(() => {
    const fetchMaintenanceStatus = async () => {
      try {
        const res = await fetch('/api/admin/maintenance', { method: 'GET' });
        if (!res.ok) {
          throw new Error('Failed to fetch maintenance status');
        }
        const data = await res.json();
        setIsMaintenanceMode(data.isMaintenanceMode);
      } catch (error) {
        console.error('Error fetching maintenance status:', error);
        // If there's an error fetching status, assume not in maintenance for now
        setIsMaintenanceMode(false);
      } finally {
        setLoadingMaintenance(false);
      }
    };

    fetchMaintenanceStatus();
  }, []);

  useEffect(() => {
    // Only proceed if maintenance status is loaded and session status is known
    if (!loadingMaintenance && status !== 'loading') {
      const userIsAdmin = session?.user?.role === 'admin';

      if (isMaintenanceMode) {
        // If in maintenance mode
        if (isMaintenancePage) {
          // If already on maintenance page, do nothing
          return;
        }

        if (!userIsAdmin) {
          // If not an admin, redirect to maintenance page
          router.replace('/maintenance');
          router.refresh(); // Force a refresh to re-evaluate layout
          return;
        }
      } else {
        // If NOT in maintenance mode
        if (isMaintenancePage) {
          // If accidentally on maintenance page, redirect to home
          router.replace('/');
          router.refresh(); // Force a refresh to re-evaluate layout
          return;
        }
      }
    }
  }, [isMaintenanceMode, loadingMaintenance, status, session, router, isMaintenancePage, isAdminPage]);

  if (loadingMaintenance || status === 'loading') {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner />
        <p className="text-xl text-gray-500 ml-4">Loading application...</p>
      </div>
    );
  }

  // If in maintenance mode and not an admin, we've already redirected.
  // If admin, or not in maintenance, render children.
  if (isMaintenanceMode && session?.user?.role !== 'admin' && !isMaintenancePage) {
    return null; // Should have been redirected
  }

  // Do not apply bg-signin if in maintenance mode or on maintenance page
  const shouldApplySigninBg = isSigninPage && !isMaintenanceMode && !isMaintenancePage;

  return (
    <div className={shouldApplySigninBg ? 'bg-signin' : ''}>
      {children}
    </div>
  );
}
