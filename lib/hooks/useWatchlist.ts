'use client';

import { useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface WatchHistoryData {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string;
  progress: number;
  currentTime: number;
  totalDuration: number;
  finished: boolean;
}

export function useWatchHistory() {
  const { data: session } = useSession();

  const updateWatchHistory = useCallback(
    async (data: WatchHistoryData) => {
      if (!session?.user) {
        return;
      }

      try {
        const response = await fetch('/api/watch-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          console.error('Failed to update watch history');
        }
      } catch (error) {
        console.error('Error updating watch history:', error);
      }
    },
    [session]
  );

  return { updateWatchHistory };
}

export function useWatchlist() {
  const { data: session } = useSession();

  const addToWatchlist = useCallback(
    async (mediaId: number, mediaType: 'movie' | 'tv', title: string, posterPath: string, rating?: number) => {
      if (!session?.user) {
        return false;
      }

      try {
        const response = await fetch('/api/watchlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mediaId,
            mediaType,
            title,
            posterPath,
            rating,
          }),
        });

        return response.ok;
      } catch (error) {
        console.error('Error adding to watchlist:', error);
        return false;
      }
    },
    [session]
  );

  const removeFromWatchlist = useCallback(
    async (mediaId: number, mediaType: 'movie' | 'tv') => {
      if (!session?.user) {
        return false;
      }

      try {
        const response = await fetch('/api/watchlist', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mediaId,
            mediaType,
          }),
        });

        return response.ok;
      } catch (error) {
        console.error('Error removing from watchlist:', error);
        return false;
      }
    },
    [session]
  );

  const checkWatchlistStatus = useCallback(
    async (mediaId: number, mediaType: 'movie' | 'tv') => {
      if (!session?.user) {
        return false;
      }

      try {
        const response = await fetch(`/api/watchlist/status?mediaId=${mediaId}&mediaType=${mediaType}`);
        if (!response.ok) {
          console.error('Failed to check watchlist status');
          return false;
        }
        const data = await response.json();
        return data.isInWatchlist;
      } catch (error) {
        console.error('Error checking watchlist status:', error);
        return false;
      }
    },
    [session]
  );

  const checkMultipleWatchlistStatuses = useCallback(
    async (
      mediaItems: { mediaId: number; mediaType: 'movie' | 'tv' }[]
    ): Promise<Record<string, boolean>> => {
      if (!session?.user) {
        return {};
      }
      try {
        const mediaIds = mediaItems.map(item => item.mediaId).join(',');
        const mediaTypes = mediaItems.map(item => item.mediaType).join(',');

        const response = await fetch(`/api/watchlist/status?mediaIds=${mediaIds}&mediaTypes=${mediaTypes}`);

        if (!response.ok) {
          console.error('Failed to check multiple watchlist statuses');
          return {};
        }

        const data = await response.json();
        return data; // The API returns the status map directly
      } catch (error) {
        console.error('Error checking multiple watchlist statuses:', error);
        return {};
      }
    },
    [session]
  );

  return { addToWatchlist, removeFromWatchlist, checkWatchlistStatus, checkMultipleWatchlistStatuses };
}