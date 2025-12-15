import { flushAllPlaytimeUpdates } from '@/lib/playtimeBatch';

/**
 * Enhanced watch detection - saves playtime when user stops watching
 * Handles: Page close, tab switch, pause, focus loss
 */
export function usePlaytimeAutoSave() {
  const handleBeforeUnload = async () => {
    // Flush any pending playtime updates before page closes
    console.log('[Playtime] Flushing updates before unload');
    await flushAllPlaytimeUpdates();
  };

  const handlePageHidden = async () => {
    // Flush when user switches tabs
    console.log('[Playtime] Flushing updates - page hidden');
    await flushAllPlaytimeUpdates();
  };

  const handleWindowBlur = async () => {
    // Flush when window loses focus (user switches windows)
    console.log('[Playtime] Flushing updates - window blur');
    await flushAllPlaytimeUpdates();
  };

  return {
    handleBeforeUnload,
    handlePageHidden,
    handleWindowBlur,
  };
}
