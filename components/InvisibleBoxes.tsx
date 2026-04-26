'use client';

import React, { useEffect, useRef, useState } from 'react';

interface InvisibleBoxProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  action: string;
  customAction?: string;
  cursorStyle?: string;
  onAction?: (action: string) => void;
  isDraggable?: boolean;
  isResizable?: boolean;
  onPositionChange?: (x: number, y: number) => void;
  onSizeChange?: (width: number, height: number) => void;
  showOutline?: boolean;
  containerRef?: React.RefObject<HTMLElement | null>;
  allowOutsideContainer?: boolean;
}

export default function InvisibleBox({
  id,
  x: initialX,
  y: initialY,
  width: initialWidth,
  height: initialHeight,
  action,
  customAction,
  cursorStyle,
  onAction,
  isDraggable = false,
  isResizable = false,
  onPositionChange,
  onSizeChange,
  showOutline = false,
  containerRef,
  allowOutsideContainer = false,
}: InvisibleBoxProps) {
  const [x, setX] = useState(initialX);
  const [y, setY] = useState(initialY);
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setX(initialX), [initialX]);
  useEffect(() => setY(initialY), [initialY]);
  useEffect(() => setWidth(initialWidth), [initialWidth]);
  useEffect(() => setHeight(initialHeight), [initialHeight]);

  const getContainerBounds = () => {
    return containerRef?.current?.getBoundingClientRect();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDraggable || isResizing) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - x,
      y: e.clientY - y,
    };
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!isResizable) return;

    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width,
      height,
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;
      
      if (allowOutsideContainer) {
        // Allow placement anywhere on the page
        setX(newX);
        setY(newY);
        onPositionChange?.(Math.round(newX), Math.round(newY));
      } else {
        // Constrain to container bounds
        const bounds = getContainerBounds();
        if (bounds) {
          const boundedX = Math.max(0, Math.min(newX, bounds.width - width));
          const boundedY = Math.max(0, Math.min(newY, bounds.height - height));
          setX(boundedX);
          setY(boundedY);
          onPositionChange?.(Math.round(boundedX), Math.round(boundedY));
        } else {
          setX(newX);
          setY(newY);
          onPositionChange?.(Math.round(newX), Math.round(newY));
        }
      }
    }

    if (isResizing) {
      const deltaX = e.clientX - resizeStartRef.current.x;
      const deltaY = e.clientY - resizeStartRef.current.y;

      let newWidth = Math.max(40, resizeStartRef.current.width + deltaX);
      let newHeight = Math.max(40, resizeStartRef.current.height + deltaY);
      
      if (!allowOutsideContainer) {
        // Only constrain resize when not allowing outside container
        const bounds = getContainerBounds();
        if (bounds) {
          newWidth = Math.min(newWidth, bounds.width - x);
          newHeight = Math.min(newHeight, bounds.height - y);
        }
      }

      setWidth(newWidth);
      setHeight(newHeight);
      onSizeChange?.(Math.round(newWidth), Math.round(newHeight));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, width, height, x, y]);

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging || isResizing) return;
    e.stopPropagation();
    onAction?.(action);
  };

  // Apply cursor style with fallback to drag cursor if draggable
  const cursor = cursorStyle || (isDraggable ? 'move' : 'auto');

  return (
    <div
      ref={boxRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className="absolute transition-opacity hover:opacity-50"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: 'transparent',
        border: showOutline ? '2px dashed rgba(255, 0, 0, 0.45)' : 'none',
        borderRadius: '4px',
        pointerEvents: 'auto',
        userSelect: 'none',
        touchAction: 'none',
        zIndex: 50,
        cursor,
      }}
      title={showOutline ? `Action: ${action}${customAction ? ` (${customAction})` : ''}` : undefined}
    >
      {isResizable && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-4 h-4 bg-red-500 cursor-se-resize rounded-sm"
          style={{
            opacity: showOutline ? 0.9 : 0,
            transition: 'opacity 0.2s',
          }}
        />
      )}
    </div>
  );
}
