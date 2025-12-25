"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  tagline?: string | null;
  description?: string | null;
};

export default function MoreInfoModal({ isOpen, onClose, title, tagline, description }: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // mount -> animate in
      setVisible(true);
    } else {
      // animate out then unmount
      setVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    // Focus close button for accessibility
    setTimeout(() => closeRef.current?.focus(), 0);

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow || '';
      document.body.style.overflow = prevBodyOverflow || '';
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen && !visible) return null;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Centered modal */}
      <div
        aria-modal="true"
        role="dialog"
        className={`relative z-[10000] w-full max-w-3xl mx-auto transform transition-all duration-300 ease-out ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        <div className="rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#E50914] to-[#b31217] px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <h3 className="text-xl font-bold text-white leading-tight">{title}</h3>
                {tagline && <p className="text-sm text-white/90 italic mt-1">“{tagline}”</p>}
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label="Close"
                className="text-white hover:text-white/90 focus:outline-none rounded p-1 ml-4"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="bg-[#0A0A0A] p-6 max-h-[75vh] overflow-auto">
            {description ? (
              <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                {description}
              </div>
            ) : (
              <div className="text-gray-400">No description available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modal, document.body);
  }

  return modal;
}
