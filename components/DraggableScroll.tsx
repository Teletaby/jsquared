'use client';

import { useRef, useState, useEffect } from 'react';

interface DraggableScrollProps {
  children: React.ReactNode;
}

const DraggableScroll: React.FC<DraggableScrollProps> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [targetScrollLeft, setTargetScrollLeft] = useState(0);
  const friction = 0.9; // Adjust for scroll speed (0-1)

  useEffect(() => {
    const animateScroll = () => {
      if (ref.current) {
        const currentScroll = ref.current.scrollLeft;
        const newScroll = currentScroll + (targetScrollLeft - currentScroll) * (1 - friction);
        ref.current.scrollLeft = newScroll;
        if (Math.abs(targetScrollLeft - newScroll) > 0.5) {
          requestAnimationFrame(animateScroll);
        }
      }
    };
    if (!isMouseDown) {
      requestAnimationFrame(animateScroll);
    }
  }, [targetScrollLeft, isMouseDown, friction]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (ref.current) {
      setIsMouseDown(true);
      setStartX(e.pageX - ref.current.offsetLeft);
      setScrollLeft(ref.current.scrollLeft);
      ref.current.classList.add('cursor-grabbing');
    }
  };

  const onMouseUp = () => {
    if (ref.current) {
      setIsMouseDown(false);
      ref.current.classList.remove('cursor-grabbing');
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX) * 2; // The multiplier changes the scroll speed
    const newScrollLeft = scrollLeft - walk;
    ref.current.scrollLeft = newScrollLeft;
    setTargetScrollLeft(newScrollLeft);
  };

  return (
    <div
      ref={ref}
      className="flex overflow-x-auto space-x-4 pb-4 cursor-grab hide-scrollbar"
      onMouseDown={onMouseDown}
      onMouseLeave={onMouseUp}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
    >
      {children}
    </div>
  );
};

export default DraggableScroll;
