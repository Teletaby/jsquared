'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type VideoSource = 'videasy' | 'vidlink' | 'vidnest';

export type PlayOptions = {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title?: string;
  posterPath?: string | null;
  videoSource?: VideoSource;
  initialTime?: number;
  embedUrl?: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
  onTimeUpdate?: (time: number) => void;
};

type PlayerContextType = {
  isActive: boolean;
  state: PlayOptions | null;
  play: (options: PlayOptions) => void;
  stop: () => void;
  update: (options: Partial<PlayOptions>) => void;
};

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayOptions | null>(null);
  const isActive = !!state;

  const play = useCallback((options: PlayOptions) => {
    setState({ ...options });
  }, []);

  const stop = useCallback(() => {
    setState(null);
  }, []);

  const update = useCallback((options: Partial<PlayOptions>) => {
    setState((s) => (s ? { ...s, ...options } : s));
  }, []);

  return (
    <PlayerContext.Provider value={{ isActive, state, play, stop, update }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}

export default PlayerProvider;
