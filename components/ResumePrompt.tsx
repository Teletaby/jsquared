'use client';

import React, { useEffect, useState } from 'react';
import { Play, X, Clock } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ResumePromptProps {
  show: boolean;
  title: string;
  savedTime: number;
  totalDuration: number;
  posterPath?: string;
  onResume: () => void;
  onStart: () => void;
  onDismiss: () => void;
  autoHideDuration?: number; // Auto dismiss after X seconds
}

const ResumePrompt: React.FC<ResumePromptProps> = ({
  show,
  title,
  savedTime,
  totalDuration,
  posterPath,
  onResume,
  onStart,
  onDismiss,
  autoHideDuration = 10000, // 10 seconds
}) => {
  const [isVisible, setIsVisible] = useState(show);
  const [timeLeft, setTimeLeft] = useState(Math.ceil(autoHideDuration / 1000));

  useEffect(() => {
    setIsVisible(show);
    setTimeLeft(Math.ceil(autoHideDuration / 1000));
  }, [show, autoHideDuration]);

  // Auto-hide countdown
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  const handleResume = () => {
    setIsVisible(false);
    onResume();
  };

  const handleStart = () => {
    setIsVisible(false);
    onStart();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss();
  };

  // Format time
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress
  const progress = totalDuration > 0 ? (savedTime / totalDuration) * 100 : 0;

  if (!isVisible) return null;

  const promptContent = (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-black/50 backdrop-blur-sm p-4" onClick={handleDismiss}>
      <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full border border-gray-700 overflow-hidden animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="relative">
          {posterPath && (
            <img
              src={`https://image.tmdb.org/t/p/w500${posterPath}`}
              alt={title}
              className="w-full h-32 object-cover opacity-30"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-900" />
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-white hover:bg-white/20 p-1 rounded-full transition z-10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Title */}
          <h3 className="text-lg font-bold text-white mb-1 break-words">{title || 'Continue Watching'}</h3>
          <p className="text-gray-400 text-xs mb-4 uppercase tracking-wider">Continue your progress</p>

          {/* Resume Info */}
          <div className="mb-6 p-4 bg-gradient-to-r from-red-900/30 to-red-800/20 rounded border border-red-700/40">
            <div className="flex items-center gap-3 mb-3">
              <Clock size={18} className="text-red-400" />
              <span className="text-white font-semibold text-sm">Continue Watching</span>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden mb-2">
                <div
                  className="bg-gradient-to-r from-red-600 to-red-500 h-full transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-300">
                <span>{formatTime(savedTime)}</span>
                <span>{formatTime(totalDuration)}</span>
              </div>
            </div>

            <p className="text-red-200 text-xs font-medium">
              {progress.toFixed(0)}% watched • {formatTime(totalDuration - savedTime)} remaining
            </p>
          </div>

          {/* Action Buttons - Netflix Style */}
          <div className="space-y-2 mb-4">
            {/* Resume Button */}
            <button
              onClick={handleResume}
              className="w-full bg-white text-black hover:bg-white/90 active:bg-white/80 font-bold py-2.5 px-4 rounded transition flex items-center justify-center gap-2 shadow-lg transform hover:scale-[1.02]"
            >
              <Play size={16} fill="currentColor" />
              Resume from {formatTime(savedTime)}
            </button>

            {/* Start from Beginning Button */}
            <button
              onClick={handleStart}
              className="w-full bg-gray-700/60 hover:bg-gray-600/70 active:bg-gray-800 text-white font-semibold py-2.5 px-4 rounded transition transform hover:scale-[1.02]"
            >
              Start from Beginning
            </button>
          </div>

          {/* Auto-dismiss timer */}
          <div className="text-center text-gray-400 text-xs">
            Closes in {timeLeft}s
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(promptContent, document.body);
  }

  return promptContent;};

export default ResumePrompt;