"use client";

import { useEffect, useState } from 'react';
import { useDisableScroll } from '@/lib/hooks/useDisableScroll';

interface TrailerPopupProps {
  trailerKey: string;
  onClose: () => void;
}

const TrailerPopup: React.FC<TrailerPopupProps> = ({ trailerKey, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  useDisableScroll(isOpen);

  useEffect(() => {
    setIsOpen(true);

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300); // Wait for animation to finish
  };

  return (
    <div
      className={`fixed inset-0 z-[99999] flex justify-center items-center transition-opacity duration-300 p-4 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.99)' }}
      onClick={handleClose}
    >
      <div
        className={`relative z-[100000] bg-black p-3 sm:p-4 rounded-lg shadow-2xl w-full max-w-3xl transition-all duration-300 transform-gpu ${isOpen ? 'transform scale-100 opacity-100' : 'transform scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute -top-3 sm:-top-4 -right-3 sm:-right-4 bg-white text-black rounded-full p-1.5 sm:p-2 hover:bg-gray-200 transition-colors z-[100001]"
          aria-label="Close trailer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="aspect-w-16 aspect-h-9">
          <iframe
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video player"
            className="w-full h-full min-h-[200px] sm:min-h-[400px]"
          ></iframe>
        </div>
      </div>
    </div>
  );
};

export default TrailerPopup;

