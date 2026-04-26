'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import InvisibleBox from './InvisibleBoxes';

interface Box {
  _id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  action: string;
  customAction?: string;
  cursorStyle?: string;
  clickCount?: number;
  triggerOnLoad?: boolean;
  pageType: string;
  playerSource?: string;
  isActive: boolean;
}

interface InvisibleBoxesManagerProps {
  mediaId?: number;
  mediaType?: 'movie' | 'tv';
  playerSource?: 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock';
  onAction?: (action: string, customAction?: string, clickCount?: number, triggerSource?: 'click' | 'load') => void;
  onBoxTriggered?: (box: Box, triggerSource: 'click' | 'load') => void;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export default function InvisibleBoxesManager({
  mediaId,
  mediaType,
  playerSource,
  onAction,
  onBoxTriggered,
  containerRef,
}: InvisibleBoxesManagerProps) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const loadTriggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchBoxes = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        
        if (mediaType) {
          params.append('pageType', mediaType);
        }
        if (playerSource) {
          params.append('playerSource', playerSource);
        }
        if (mediaId) {
          params.append('mediaId', mediaId.toString());
        }

        console.log('📦 Fetching invisible boxes for:', { mediaType, playerSource, mediaId });
        const res = await fetch(`/api/admin/invisible-boxes?${params.toString()}`);
        
        if (res.ok) {
          const data = await res.json();
          console.log('📦 Found boxes:', data.boxes?.length || 0, data.boxes?.map((b: any) => ({ name: b.name, action: b.action, triggerOnLoad: b.triggerOnLoad })));
          setBoxes(data.boxes || []);
        } else {
          console.error('Failed to fetch invisible boxes');
        }
      } catch (error) {
        console.error('Error fetching invisible boxes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBoxes();
  }, [mediaId, mediaType, playerSource]);

  const handleAction = useCallback((action: string, customAction?: string, clickCount = 1, triggerSource: 'click' | 'load' = 'click') => {
    console.log('📦 Invisible box triggered:', { action, customAction, clickCount, triggerSource });
    onAction?.(action, customAction, clickCount, triggerSource);
  }, [onAction]);

  const handleBoxAction = useCallback((box: Box, triggerSource: 'click' | 'load' = 'click') => {
    // Notify about the triggered box
    onBoxTriggered?.(box, triggerSource);
    
    // Then execute the action
    handleAction(box.action, box.customAction, Math.max(1, Number(box.clickCount) || 1), triggerSource);
  }, [handleAction, onBoxTriggered]);

  useEffect(() => {
    if (loading || boxes.length === 0) return;

    const mediaKey = `${mediaType || 'all'}-${mediaId || 'all'}-${playerSource || 'all'}`;

    boxes.forEach((box) => {
      if (!box.triggerOnLoad) return;

      const boxKey = `${mediaKey}-${box._id}`;
      if (loadTriggeredRef.current.has(boxKey)) {
        console.log('Box already triggered on load:', box.name);
        return;
      }

      console.log('🎯 Triggering box on load:', box.name, box.action, 'playerSource:', playerSource);
      loadTriggeredRef.current.add(boxKey);
      handleBoxAction(box, 'load');
    });
  }, [boxes, loading, mediaId, mediaType, playerSource, handleBoxAction]);

  if (loading || boxes.length === 0) {
    return null;
  }

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 40,
        }}
      >
        {boxes
          .filter((box) => box.action !== 'click')
          .map((box) => (
            <InvisibleBox
              key={box._id}
              id={box._id}
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              action={box.action}
              customAction={box.customAction}
              cursorStyle={box.cursorStyle}
              onAction={() => handleBoxAction(box, 'click')}
              isDraggable={false}
              isResizable={false}
              showOutline={false}
              containerRef={containerRef}
              allowOutsideContainer={false}
            />
          ))}
      </div>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 39,
        }}
      >
        {boxes
          .filter((box) => box.action === 'click')
          .map((box) => (
            <InvisibleBox
              key={box._id}
              id={box._id}
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              action={box.action}
              customAction={box.customAction}
              cursorStyle={box.cursorStyle}
              onAction={() => handleBoxAction(box, 'click')}
              isDraggable={false}
              isResizable={false}
              showOutline={false}
              allowOutsideContainer={true}
            />
          ))}
      </div>
    </>
  );
}
