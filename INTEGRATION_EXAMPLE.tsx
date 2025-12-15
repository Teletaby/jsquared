'use client';

/**
 * INTEGRATION EXAMPLE: How to use AdvancedVideoPlayer and ResumePrompt
 * in your TV show page
 * 
 * This shows the minimal changes needed to integrate the new system
 */

import AdvancedVideoPlayer from '@/components/AdvancedVideoPlayer';
import ResumePrompt from '@/components/ResumePrompt';
import VideoSourceSelector from '@/components/VideoSourceSelector';
import { useAdvancedPlaytime } from '@/lib/hooks/useAdvancedPlaytime';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface IntegrationExampleProps {
  tmdbId: number;
  currentSeason: number;
  currentEpisode: number;
  episodeTitle: string;
  episodePosterPath?: string;
}

/**
 * STEP 1: Add these imports to your existing TV page
 * 
 * import AdvancedVideoPlayer from '@/components/AdvancedVideoPlayer';
 * import ResumePrompt from '@/components/ResumePrompt';
 * import { useAdvancedPlaytime } from '@/lib/hooks/useAdvancedPlaytime';
 */

/**
 * STEP 2: Add these state variables to your TV page component
 * 
 * const [videoSource, setVideoSource] = useState<'vidking' | 'vidsrc'>('vidking');
 * const [savedProgress, setSavedProgress] = useState(0);
 * const [savedDuration, setSavedDuration] = useState(0);
 * const [showResumePrompt, setShowResumePrompt] = useState(false);
 * const [resumeChoice, setResumeChoice] = useState<'yes' | 'no'>('no');
 * const [showSourceSelector, setShowSourceSelector] = useState(false);
 * const [pendingSource, setPendingSource] = useState<'vidking' | 'vidsrc'>('vidking');
 * const { queueUpdate } = useAdvancedPlaytime();
 * const { data: session } = useSession();
 */

export default function TVPageIntegrationExample({
  tmdbId,
  currentSeason,
  currentEpisode,
  episodeTitle,
  episodePosterPath,
}: IntegrationExampleProps) {
  // ===== VIDEO PLAYER STATE =====
  const [videoSource, setVideoSource] = useState<'vidking' | 'vidsrc'>('vidking');
  const [savedProgress, setSavedProgress] = useState(0);
  const [savedDuration, setSavedDuration] = useState(0);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeChoice, setResumeChoice] = useState<'yes' | 'no'>('no');
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [pendingSource, setPendingSource] = useState<'vidking' | 'vidsrc'>('vidking');
  
  const { queueUpdate } = useAdvancedPlaytime();
  const { data: session } = useSession();

  // ===== FETCH SAVED PROGRESS =====
  useEffect(() => {
    if (!session?.user) {
      setResumeChoice('no');
      return;
    }

    const fetchProgress = async () => {
      try {
        const response = await fetch('/api/watch-history');
        if (response.ok) {
          const history = await response.json();
          
          // Find saved progress for this specific episode
          const episodeHistory = history.find(
            (item: any) =>
              item.mediaId === tmdbId &&
              item.mediaType === 'tv' &&
              item.seasonNumber === currentSeason &&
              item.episodeNumber === currentEpisode
          );

          if (episodeHistory?.currentTime > 0) {
            setSavedProgress(episodeHistory.currentTime);
            setSavedDuration(episodeHistory.totalDuration || 0);
            setShowResumePrompt(true);
          }
        }
      } catch (error) {
        console.error('Error fetching progress:', error);
      }
    };

    // Reset on episode change
    setSavedProgress(0);
    setSavedDuration(0);
    setResumeChoice('no');
    fetchProgress();
  }, [session, tmdbId, currentSeason, currentEpisode]);

  // ===== BUILD EMBED URL =====
  const embedUrl = `https://www.vidking.net/embed/tv/${tmdbId}/${currentSeason}/${currentEpisode}${
    resumeChoice === 'yes' && savedProgress > 0
      ? `?progress=${Math.floor(savedProgress)}`
      : ''
  }`;

  // ===== HANDLERS =====
  const handleResumeYes = () => {
    setResumeChoice('yes');
    setShowResumePrompt(false);
  };

  const handleResumeNo = () => {
    setResumeChoice('no');
    setShowResumePrompt(false);
  };

  const handleSourceConfirm = () => {
    setVideoSource(pendingSource);
    setShowSourceSelector(false);
  };

  // ===== RENDER =====
  return (
    <div className="space-y-8 bg-gray-900 text-white p-6">
      {/* ===== RESUME PROMPT ===== */}
      <ResumePrompt
        show={showResumePrompt}
        title={`${episodeTitle} - S${currentSeason}E${currentEpisode}`}
        savedTime={savedProgress}
        totalDuration={savedDuration || 3600}
        posterPath={episodePosterPath}
        onResume={handleResumeYes}
        onStart={handleResumeNo}
        onDismiss={() => setShowResumePrompt(false)}
        autoHideDuration={10000}
      />

      {/* ===== VIDEO PLAYER ===== */}
      <div className="w-full">
        <AdvancedVideoPlayer
          embedUrl={embedUrl}
          title={`${episodeTitle} - Season ${currentSeason} Episode ${currentEpisode}`}
          mediaId={tmdbId}
          mediaType="tv"
          posterPath={episodePosterPath}
          seasonNumber={currentSeason}
          episodeNumber={currentEpisode}
          initialTime={resumeChoice === 'yes' ? savedProgress : 0}
        />
      </div>

      {/* ===== SOURCE SELECTOR ===== */}
      {showSourceSelector && (
        <div className="flex justify-center">
          <VideoSourceSelector
            currentSource={videoSource}
            onSourceChange={setPendingSource}
            onConfirm={handleSourceConfirm}
            showWarning={true}
          />
        </div>
      )}

      {/* ===== VIDEO SOURCE BUTTON ===== */}
      <div className="flex gap-4">
        <button
          onClick={() => setShowSourceSelector(!showSourceSelector)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
        >
          📺 Switch Source: {videoSource === 'vidking' ? 'VidKing' : 'VidSrc'}
        </button>
      </div>

      {/* ===== EPISODE INFO ===== */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-2xl font-bold mb-4">{episodeTitle}</h3>
        <p className="text-gray-300 mb-4">Season {currentSeason}, Episode {currentEpisode}</p>
        
        {savedProgress > 0 && (
          <div className="bg-blue-900/30 border border-blue-700 rounded p-3">
            <p className="text-blue-200">
              Last watched at {Math.floor(savedProgress / 60)}m {Math.floor(savedProgress % 60)}s
              ({((savedProgress / (savedDuration || 1)) * 100).toFixed(0)}% complete)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
