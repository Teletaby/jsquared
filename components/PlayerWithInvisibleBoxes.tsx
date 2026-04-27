'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import InvisibleBoxesManager from './InvisibleBoxesManager';
import InlineInvisibleBoxEditor from './InlineInvisibleBoxEditor';
import SacrificialClickOverlay from './SacrificialClickOverlay';

interface PlayerWithInvisibleBoxesProps {
  children: React.ReactNode;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  playerSource: 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock';
  adminEditorEnabled?: boolean;
  onInvisibleBoxAction?: (action: string, customAction?: string, clickCount?: number, triggerSource?: 'click' | 'load') => void;
}

export default function PlayerWithInvisibleBoxes({
  children,
  mediaId,
  mediaType,
  playerSource,
  adminEditorEnabled = false,
  onInvisibleBoxAction,
}: PlayerWithInvisibleBoxesProps) {
  const LOAD_TRIGGER_DELAY_MS = 2000; // 2 seconds to ensure iframe is ready
  const ACTION_REPEAT_DELAY_MS = 120;
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenPromotionInFlightRef = useRef(false);
  const [isInlineToolEnabled, setIsInlineToolEnabled] = useState(true);
  const [triggeredBox, setTriggeredBox] = useState<{ name: string; action: string; triggerSource: 'click' | 'load' } | null>(null);

  useEffect(() => {
    if (!adminEditorEnabled) return;

    const handleFullscreenChange = () => {
      const container = playerContainerRef.current;
      const fullscreenEl = document.fullscreenElement as HTMLElement | null;

      if (!container || !fullscreenEl) {
        fullscreenPromotionInFlightRef.current = false;
        return;
      }

      // Already fullscreen on our wrapper; nothing to fix.
      if (fullscreenEl === container) {
        fullscreenPromotionInFlightRef.current = false;
        return;
      }

      // If a child player element entered fullscreen (video/iframe), promote fullscreen
      // to the wrapper so admin overlay tools can remain visible.
      if (container.contains(fullscreenEl) && !fullscreenPromotionInFlightRef.current) {
        fullscreenPromotionInFlightRef.current = true;
        container.requestFullscreen().catch((error) => {
          console.warn('Failed to promote fullscreen to player wrapper:', error);
          fullscreenPromotionInFlightRef.current = false;
        });

        window.setTimeout(() => {
          fullscreenPromotionInFlightRef.current = false;
        }, 600);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [adminEditorEnabled]);

  useEffect(() => {
    if (!adminEditorEnabled) return;

    const fetchToggle = async () => {
      try {
        const res = await fetch('/api/admin/maintenance', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setIsInlineToolEnabled(data.isInlineBoxToolEnabled ?? true);
      } catch (error) {
        console.error('Failed to fetch inline tool toggle:', error);
      }
    };

    fetchToggle();
  }, [adminEditorEnabled]);

  const handleInvisibleBoxAction = useCallback(
    (action: string, customAction?: string, clickCount = 1, triggerSource: 'click' | 'load' = 'click') => {
      const repeatCount = Math.max(1, Number(clickCount) || 1);

      const runSingleAction = () => {
        console.log('Invisible box action triggered:', { action, customAction, repeatCount, triggerSource });
        onInvisibleBoxAction?.(action, customAction, repeatCount, triggerSource);

        // Handle built-in actions
        switch (action) {
          case 'fullscreen':
            if (playerContainerRef.current) {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                playerContainerRef.current.requestFullscreen().catch((err) => {
                  console.error('Failed to enter fullscreen:', err);
                });
              }
            }
            break;
          case 'exitFullscreen':
            if (document.fullscreenElement) {
              document.exitFullscreen().catch((err) => {
                console.error('Failed to exit fullscreen:', err);
              });
            }
            break;
          case 'playPause':
            // Find and toggle video element
            const videos = playerContainerRef.current?.querySelectorAll('video');
            if (videos && videos.length > 0) {
              const video = videos[0];
              if (video.paused) {
                video.play();
              } else {
                video.pause();
              }
            }
            break;
          case 'mute':
            const videoElements = playerContainerRef.current?.querySelectorAll('video');
            if (videoElements && videoElements.length > 0) {
              const video = videoElements[0];
              video.muted = !video.muted;
            }
            break;
          case 'skip10s':
            const video1 = playerContainerRef.current?.querySelector('video');
            if (video1) {
              video1.currentTime = Math.min(video1.currentTime + 10, video1.duration);
            }
            break;
          case 'rewind10s':
            const video2 = playerContainerRef.current?.querySelector('video');
            if (video2) {
              video2.currentTime = Math.max(video2.currentTime - 10, 0);
            }
            break;
          case 'click':
            // For iframe players (like Videasy), send postMessage instead of clicking
            console.log('📍 Click action - playerSource:', playerSource);
            console.log('📍 playerContainerRef.current:', playerContainerRef.current);
            
            if (playerSource === 'videasy') {
              const iframe = playerContainerRef.current?.querySelector('iframe');
              console.log('📍 Looking for iframe...found:', !!iframe);
              
              if (iframe) {
                console.log('📍 iframe.src:', iframe.src);
                console.log('📍 iframe.contentWindow:', !!iframe.contentWindow);
              }
              
              if (iframe?.contentWindow) {
                try {
                  iframe.contentWindow.postMessage(JSON.stringify({ type: 'PLAY' }), '*');
                  console.log('✓ Sent PLAY message to Videasy player via invisible box');
                } catch (e) {
                  console.error('❌ Failed to send PLAY message:', e);
                }
              } else {
                console.warn('❌ Videasy iframe not found or contentWindow not accessible');
              }
            } else {
              // Try clicking the most relevant playable element first, then fallback to container.
              const clickableTarget =
                playerContainerRef.current?.querySelector('video, iframe, button') ||
                playerContainerRef.current;

              const dispatchClickSequence = (target: HTMLElement) => {
                try {
                  target.focus?.();
                } catch {}

                try {
                  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                } catch (e) {
                  console.warn('Failed dispatching mouse event sequence:', e);
                }

                try {
                  target.click();
                } catch (e) {
                  console.warn('Failed calling target.click():', e);
                }
              };

              if (clickableTarget instanceof HTMLElement) {
                dispatchClickSequence(clickableTarget);
              }
            }
            break;
          case 'custom':
            if (customAction) {
              window.dispatchEvent(
                new CustomEvent('jsquared:invisible-box-custom-action', {
                  detail: { customAction, mediaId, mediaType, playerSource, repeatCount, triggerSource },
                })
              );
            }
            break;
        }
      };

      for (let i = 0; i < repeatCount; i += 1) {
        const delayMs = (triggerSource === 'load' ? LOAD_TRIGGER_DELAY_MS : 0) + (i * ACTION_REPEAT_DELAY_MS);
        if (i === 0) {
          if (delayMs > 0) {
            window.setTimeout(runSingleAction, delayMs);
          } else {
            runSingleAction();
          }
        } else {
          window.setTimeout(runSingleAction, delayMs);
        }
      }
    },
    [mediaId, mediaType, onInvisibleBoxAction, playerSource]
  );

  return (
    <SacrificialClickOverlay
      onOverlayHidden={() => {
        console.log('SacrificialClickOverlay hidden');
      }}
      debug={false}
    >
      <div ref={playerContainerRef} style={{ position: 'relative', overflow: 'hidden', maxWidth: '100%' }}>
        <div style={{ pointerEvents: 'auto' }}>
          {children}
        </div>
        <InvisibleBoxesManager
          mediaId={mediaId}
          mediaType={mediaType}
          playerSource={playerSource}
          onAction={handleInvisibleBoxAction}
          onBoxTriggered={(box, triggerSource) => {
            // Only show the admin notification for click boxes that auto-trigger on load.
            if (adminEditorEnabled && isInlineToolEnabled && box.action === 'click' && triggerSource === 'load') {
              setTriggeredBox({ name: box.name, action: box.action, triggerSource });
              setTimeout(() => setTriggeredBox(null), 2000);
            }
          }}
          containerRef={playerContainerRef}
        />
        {adminEditorEnabled && isInlineToolEnabled && (
          <InlineInvisibleBoxEditor
            mediaId={mediaId}
            mediaType={mediaType}
            playerSource={playerSource}
            containerRef={playerContainerRef}
            triggeredBox={triggeredBox}
          />
        )}
      </div>
    </SacrificialClickOverlay>
  );
}
