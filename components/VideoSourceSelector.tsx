'use client';

import React from 'react';
import { AlertCircle, CheckCircle, Zap, Sparkles } from 'lucide-react';

interface SourceInfo {
  name: string;
  supportsProgress: boolean;
  supportsAutoResume: boolean;
  supportsQuality: boolean;
  supportsSubtitles: boolean;
  latency: 'low' | 'medium' | 'high';
}

interface VideoSourceSelectorProps {
  currentSource: 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock';
  /** Optional: the pending/selected candidate (separate from currentSource) */
  selectedSource?: 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock' | null;
  onSourceChange: (source: 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock') => void;
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
    vidrock: {
      name: 'VidRock',
      supportsProgress: true,
      supportsAutoResume: true,
      supportsQuality: true,
      supportsSubtitles: true,
      latency: 'low',
      description: 'Enterprise-ready streaming with seamless quality playback and full progress tracking',
      icon: '🚀',
    } as SourceInfo & { description: string; icon: string },
  };

  return (
    <div className="bg-gradient-to-b from-[#1A1A1A] to-[#0F0F0F] border border-[#333333] rounded-2xl p-8 shadow-2xl max-w-4xl backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-8">
        <Sparkles size={28} className="text-[#E50914]" />
        <h3 className="text-3xl font-bold text-white font-orbitron uppercase tracking-wider">
          Choose Stream Quality
        </h3>
      </div>

      {showWarning && (
        <div className="mb-6 p-4 bg-gradient-to-r from-[#E50914]/20 to-[#E50914]/10 border border-[#E50914]/50 rounded-xl flex gap-3 backdrop-blur-sm">
          <AlertCircle size={20} className="text-[#E50914] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[#E50914] font-bold text-sm">Switching Sources</p>
            <p className="text-gray-300 text-xs mt-1">
              Playback progress will be lost if you switch sources mid-video. Start from the beginning with the new source.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        {(Object.entries(sources) as [keyof typeof sources, typeof sources['videasy']][]).map(
          ([key, source]) => {
            const isSelected = (selectedSource ?? currentSource) === key;
            return (
              <button
                key={key}
                onClick={() => {
                  window.getSelection?.()?.removeAllRanges();
                  onSourceChange(key as 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock');
                }}
                className={`relative p-5 rounded-xl transition-all duration-300 text-left group overflow-hidden ${
                  isSelected
                    ? 'border-2 border-[#E50914] bg-gradient-to-br from-[#E50914]/20 to-[#E50914]/5 shadow-lg shadow-[#E50914]/30'
                    : 'border-2 border-[#333333] bg-[#1A1A1A]/80 hover:border-[#555555] hover:bg-[#252525] hover:shadow-lg hover:shadow-black/50'
                }`}
              >
                {/* Animated background for selected */}
                {isSelected && (
                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#E50914] to-transparent animate-pulse" />
                  </div>
                )}

                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 z-10">
                    <div className="relative">
                      <CheckCircle size={24} className="text-[#E50914]" />
                      <div className="absolute inset-0 animate-pulse">
                        <CheckCircle size={24} className="text-[#E50914] opacity-50" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative z-10">
                  <div className="text-4xl mb-3 transform group-hover:scale-110 transition-transform duration-300">
                    {source.icon}
                  </div>
                  <h4 className="text-lg font-bold text-white mb-1 font-orbitron uppercase tracking-wide">
                    {source.name}
                  </h4>
                  <p className="text-gray-400 text-xs mb-4 leading-snug line-clamp-2 h-9">
                    {source.description}
                  </p>

                  {/* Features Grid */}
                  <div className="space-y-2 text-xs">
                    <FeatureRow
                      label="Auto-Resume"
                      supported={source.supportsAutoResume}
                    />
                    <FeatureRow
                      label="Quality"
                      supported={source.supportsQuality}
                    />
                    <FeatureRow
                      label="Subtitles"
                      supported={source.supportsSubtitles}
                    />
                    <FeatureRow
                      label="Progress"
                      supported={source.supportsProgress}
                    />
                    <FeatureRow
                      label={`Speed: ${source.latency}`}
                      supported={source.latency === 'low'}
                    />
                  </div>
                </div>
              </button>
            );
          }
        )}
      </div>

      <button
        onClick={onConfirm}
        disabled={!selectedSource || selectedSource === currentSource}
        className={`w-full py-3 px-6 rounded-xl font-bold text-lg uppercase tracking-wider transition-all duration-300 font-orbitron ${
          !selectedSource || selectedSource === currentSource
            ? 'bg-[#333333] text-gray-500 cursor-not-allowed opacity-50'
            : 'bg-gradient-to-r from-[#E50914] to-[#C40812] text-white hover:from-[#FF1A20] hover:to-[#E50914] shadow-lg shadow-[#E50914]/50 hover:shadow-xl hover:shadow-[#E50914]/70 active:scale-95'
        }`}
      >
        {!selectedSource || selectedSource === currentSource
          ? 'SELECT A SOURCE'
          : 'CONFIRM & CONTINUE'}
      </button>
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
  <div
    className={`flex items-center gap-2 transition-colors duration-200 ${
      supported ? 'text-[#E50914]' : 'text-gray-600'
    }`}
  >
    <span
      className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
        supported ? 'bg-[#E50914] shadow-md shadow-[#E50914]/50' : 'bg-gray-700'
      }`}
    />
    <span className="text-xs font-medium">{label}</span>
  </div>
);

export default VideoSourceSelector;
