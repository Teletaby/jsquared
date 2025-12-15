'use client';

import React, { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface SourceWarningDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const SourceWarningDialog: React.FC<SourceWarningDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  // Disable body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full border border-gray-700 shadow-2xl">
        {/* Icon and Header */}
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
          <h2 className="text-xl font-bold text-white">Switch to Alternative Source?</h2>
        </div>

        {/* Message */}
        <div className="mb-6 space-y-3">
          <p className="text-gray-300 text-sm">
            This alternative source may not save your watch progress accurately.
          </p>
          <p className="text-gray-400 text-sm">
            However, it can still save the last title you watched. You can return to Source 1 at any time to resume with full progress tracking.
          </p>
          <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded p-3">
            <p className="text-yellow-300 text-xs">
              ⚠️ Note: Some selections might not display content properly on this source. If you experience any issues, switch back to Source 1.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            {isLoading ? 'Switching...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SourceWarningDialog;
