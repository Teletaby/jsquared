'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export function useVisitorLogging() {
  const { data: session } = useSession();

  useEffect(() => {
    // Skip logging for admin users
    if (session?.user?.role === 'admin') {
      console.log('Skipping visitor logging for admin user');
      return;
    }

    const pathname = window.location.pathname;
    
    // Skip logging for admin page
    if (pathname.startsWith('/admin')) {
      console.log('Skipping visitor logging for admin page');
      return;
    }

    console.log('useVisitorLogging hook mounted, starting visitor logging...');
    
    // Use localStorage to prevent duplicate logs within 5 seconds
    const logKey = `logged_${pathname}_${Math.floor(Date.now() / 5000)}`;
    if (sessionStorage.getItem(logKey)) {
      console.log('Skipping duplicate log for this page in current session');
      return;
    }
    sessionStorage.setItem(logKey, 'true');
    
    // Send visitor log asynchronously without blocking page load
    const logVisit = async () => {
      try {
        // Use a small delay to ensure page is ready
        setTimeout(async () => {
          console.log('Sending visitor log to API...');
          const response = await fetch('/api/visitor-log', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userAgent: navigator.userAgent,
              referer: document.referrer,
              url: pathname,
            }),
          });
          
          const result = await response.json();
          console.log('Visitor log API response:', result);
          
          if (!response.ok) {
            console.warn('Visitor logging API returned non-ok status:', response.status);
          }
        }, 100);
      } catch (error) {
        // Silently fail
        console.debug('Error in visitor logging:', error);
      }
    };

    logVisit();
  }, [session]); // Re-run when session changes
}
