'use client';

import React from 'react';
import { AlertCircle, CheckCircle, Zap } from 'lucide-react';

interface SourceInfo {
  name: string;
  supportsProgress: boolean;
  supportsAutoResume: boolean;
  supportsQuality: boolean;
  supportsSubtitles: boolean;
  latency: 'low' | 'medium' | 'high';
}

interface VideoSourceSelectorProps {
  currentSource: 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc';
  /** Optional: the pending/selected candidate (separate from currentSource) */
  selectedSource?: 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | null;
  onSourceChange: (source: 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc') => void;
  onConfirm: () => void;
  showWarning?: boolean;
}

const VideoSourceSelector: React.FC<VideoSourceSelectorProps> = ({
  currentSource,
  selectedSource = null,
  onSourceChange,
  onConfirm,
  showWarning = false,
}) => {
  const sources = {
    videasy: {
      name: 'Videasy',
      supportsProgress: true,
      supportsAutoResume: true,
      supportsQuality: true,
      supportsSubtitles: true,
      latency: 'low',
      description: 'Recommended source, full auto-resume support, fast loading',
      icon: '⚡',
    } as SourceInfo & { description: string; icon: string },
    vidlink: {
      name: 'VidLink',
      supportsProgress: true,
      supportsAutoResume: true,
      supportsQuality: true,
      supportsSubtitles: true,
      latency: 'low',
      description: 'Premium source, auto-resume support, huge library',
      icon: '🎬',
    } as SourceInfo & { description: string; icon: string },
    vidnest: {
      name: 'VIDNEST',
      supportsProgress: true,
      supportsAutoResume: true,
      supportsQuality: true,
      supportsSubtitles: true,
      latency: 'low',
      description: 'Premium source with full progress tracking, auto-resume, and quality selection',
      icon: '🎯',
    } as SourceInfo & { description: string; icon: string },
    vidsrc: {
      name: 'VidSrc',
      supportsProgress: false,
      supportsAutoResume: false,
      supportsQuality: true,
      supportsSubtitles: true,
      latency: 'medium',
      description: 'Minimal ads, seamless streaming. When logged in, watch history is recorded but timestamps are not tracked.',
      icon: '📺',
    } as SourceInfo & { description: string; icon: string },
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 shadow-xl max-w-2xl">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Zap size={24} className="text-yellow-500" />
        Select Video Source
      </h3>

      {showWarning && (
        <div className="mb-4 p-4 bg-yellow-900 border border-yellow-700 rounded-lg flex gap-3">
          <AlertCircle size={20} className="text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-200 font-semibold">Switching Sources</p>
            <p className="text-yellow-100 text-sm">
              Playback progress will be lost if you switch sources mid-video. Start from the beginning with the new source.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {(Object.entries(sources) as [keyof typeof sources, typeof sources['videasy']][]).map(
          ([key, source]) => (
            <button
              key={key}
              onClick={() => {
                // Clear any text selection when switching sources
                window.getSelection?.()?.removeAllRanges();
                onSourceChange(key as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc');
              }}
              className={`relative p-4 rounded-lg border-2 transition text-left ${
                ((selectedSource ?? currentSource) === key)
                  ? 'border-blue-500 bg-blue-900/20'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              {(selectedSource ?? currentSource) === key && (
                <div className="absolute top-2 right-2">
                  <CheckCircle size={20} className="text-blue-500" />
                </div>
              )}

              <div className="text-2xl mb-2">{source.icon}</div>
              <h4 className="text-lg font-bold text-white mb-1">{source.name}</h4>
              <p className="text-gray-300 text-sm mb-3">{source.description}</p>

              {/* Features Grid */}
              <div className="space-y-2 text-xs">
                <FeatureRow
                  label="Auto-Resume"
                  supported={source.supportsAutoResume}
                />
                <FeatureRow
                  label="Quality Selection"
                  supported={source.supportsQuality}
                />
                <FeatureRow
                  label="Subtitles"
                  supported={source.supportsSubtitles}
                />
                <FeatureRow
                  label="Progress Save"
                  supported={source.supportsProgress}
                />
                <FeatureRow
                  label={`Speed: ${source.latency}`}
                  supported={source.latency === 'low'}
                />
              </div>
            </button>
          )
        )}
      </div>

      <div className="flex gap-3">
        {/* Disable confirm until user chooses a different source */}
        <button
          onClick={onConfirm}
          disabled={!selectedSource || selectedSource === currentSource}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition"
        >
          {(!selectedSource || selectedSource === currentSource) ? 'Select a source' : 'Confirm & Continue'}
        </button>
      </div>
    </div>
  );
};

/**
 * Feature row component
 */
interface FeatureRowProps {
  label: string;
  supported: boolean;
}

const FeatureRow: React.FC<FeatureRowProps> = ({ label, supported }) => (
  <div className={`flex items-center gap-2 ${supported ? 'text-green-400' : 'text-gray-500'}`}>
    <span className={`w-2 h-2 rounded-full ${supported ? 'bg-green-400' : 'bg-gray-600'}`} />
    {label}
  </div>
);

export default VideoSourceSelector;
