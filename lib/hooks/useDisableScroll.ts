import { useEffect } from 'react';

/**
 * Custom hook to disable/enable body scrolling when a modal/popup is open
 * @param isOpen - Whether the modal is open
 */
export const useDisableScroll = (isOpen: boolean) => {
  useEffect(() => {
    if (isOpen) {
      // Disable scrolling
      document.body.style.overflow = 'hidden';
      // Also prevent scroll on html element for better compatibility
      document.documentElement.style.overflow = 'hidden';
    } else {
      // Re-enable scrolling
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }

    // Cleanup function to re-enable scrolling on unmount
    return () => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, [isOpen]);
};
