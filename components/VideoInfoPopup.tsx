'use client';

import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import { useDisableScroll } from '@/lib/hooks/useDisableScroll';

const VideoInfoPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  useDisableScroll(isOpen);

  return (
    <>
      {/* Info Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center w-8 h-8 ml-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors group"
        title="Get help with playback"
        aria-label="Info"
      >
        <Info size={16} className="text-gray-300 group-hover:text-white" />
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4 pt-24"
          onClick={() => setIsOpen(false)}
        >
          {/* Modal */}
          <div
            className="relative w-full max-w-xs bg-gray-900 rounded-lg shadow-2xl border border-gray-700 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {/* Content */}
            <div className="pr-5">
              <h2 className="text-lg font-bold text-white mb-3">Playback Tips</h2>

              {/* Adblocker Section */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-blue-400 mb-1 flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">1</span>
                  Use an Adblocker
                </h3>
                <p className="text-xs text-gray-300 leading-snug ml-6">
                  We recommend using an adblocker extension like uBlock Origin, Adblock Plus, or Brave Browser.
                </p>
              </div>

              {/* Slow Loading Section */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-green-400 mb-1 flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">2</span>
                  Slow Loading?
                </h3>
                <p className="text-xs text-gray-300 leading-snug ml-6">
                  Try changing video sources to get better speed and stability.
                </p>
              </div>

              {/* Additional Tips */}
              <div className="mb-3">
                <h3 className="text-xs font-semibold text-purple-400 mb-1 flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">3</span>
                  Other Tips
                </h3>
                <ul className="text-xs text-gray-300 leading-snug ml-6 space-y-0.5">
                  <li>• Clear browser cache if stuttering</li>
                  <li>• Disable VPN/Proxy if needed</li>
                  <li>• Try a different browser</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-gray-700">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VideoInfoPopup;
