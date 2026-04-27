'use client';

import React, { useRef, useEffect, useState } from 'react';

interface SacrificialClickOverlayProps {
  children: React.ReactNode;
  onOverlayHidden?: () => void;
  debug?: boolean;
}

/**
 * SacrificialClickOverlay Component
 *
 * Intercepts the first click on an iframe to prevent ad scripts from detecting it.
 * Works by displaying a transparent overlay on top of the iframe. When clicked,
 * it hides itself, allowing subsequent clicks to reach the real player.
 *
 * How it works:
 * 1. User sees the website with video player
 * 2. User clicks the "Play" button (actually clicks the overlay)
 * 3. The ad script inside iframe never detects the click
 * 4. JavaScript hides the overlay
 * 5. User's second click reaches the real player
 */
export default function SacrificialClickOverlay({
  children,
  onOverlayHidden,
  debug = false,
}: SacrificialClickOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect when iframe is loaded
    const detectIframeLoad = () => {
      const iframe = container.querySelector('iframe');
      if (iframe) {
        if (debug) {
          console.log('🎬 SacrificialClickOverlay: iframe detected, enabling overlay');
        }
        setIframeLoaded(true);

        // Monitor iframe load event as backup
        const handleLoad = () => {
          if (debug) {
            console.log('🎬 SacrificialClickOverlay: iframe loaded event fired');
          }
        };
        iframe.addEventListener('load', handleLoad);

        return () => {
          iframe.removeEventListener('load', handleLoad);
        };
      }
    };

    // Check immediately
    detectIframeLoad();

    // Also check periodically in case iframe is added dynamically
    const checkInterval = setInterval(() => {
      detectIframeLoad();
    }, 500);

    return () => clearInterval(checkInterval);
  }, [debug]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (debug) {
      console.log('🎬 SacrificialClickOverlay: Click intercepted, hiding overlay');
    }

    setIsOverlayVisible(false);
    onOverlayHidden?.();
  };

  const handleOverlayTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (debug) {
      console.log('🎬 SacrificialClickOverlay: Touch intercepted, hiding overlay');
    }

    setIsOverlayVisible(false);
    onOverlayHidden?.();
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
    >
      {children}

      {iframeLoaded && isOverlayVisible && (
        <div
          onClick={handleOverlayClick}
          onTouchStart={handleOverlayTouchStart}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            zIndex: 9999,
            cursor: 'pointer',
            // Allow pointer events to pass through only for non-click interactions
            pointerEvents: 'auto',
          }}
          role="button"
          tabIndex={0}
          aria-label="Click to continue playing video"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleOverlayClick(e as any);
            }
          }}
        />
      )}
    </div>
  );
}
