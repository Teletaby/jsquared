'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export function useVisitorLogging() {
  const { data: session } = useSession();

  useEffect(() => {
    // Skip logging for admin users
    if (session?.user?.role === 'admin') {
      return;
    }

    const pathname = window.location.pathname;
    
    // Skip logging for admin page
    if (pathname.startsWith('/admin')) {
      return;
    }
    
    // Use localStorage to prevent duplicate logs within 5 seconds
    const logKey = `logged_${pathname}_${Math.floor(Date.now() / 5000)}`;
    if (sessionStorage.getItem(logKey)) {
      return;
    }
    sessionStorage.setItem(logKey, 'true');
    
    // Send visitor log asynchronously without blocking page load
    const logVisit = async () => {
      try {
        // Use a small delay to ensure page is ready
        setTimeout(async () => {
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
          
          await response.json();
          
          if (!response.ok) {
            // Silently fail
          }
        }, 100);
      } catch (error) {
        // Silently fail
      }
    };

    logVisit();
  }, [session]); // Re-run when session changes
}
