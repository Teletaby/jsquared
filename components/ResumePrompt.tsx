'use client';

import React, { useEffect, useState } from 'react';
import { Play, X, Clock } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full border border-gray-700 overflow-hidden animate-in fade-in duration-200">
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
          <h3 className="text-lg font-bold text-white mb-2 break-words">{title || 'Continue Watching'}</h3>
          <p className="text-gray-400 text-sm mb-4">Resume your watch progress</p>

          {/* Resume Info */}
          <div className="mb-6 p-4 bg-blue-900/30 rounded-lg border border-blue-700/50">
            <div className="flex items-center gap-3 mb-3">
              <Clock size={20} className="text-blue-400" />
              <span className="text-white font-semibold">Continue Watching</span>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden mb-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-300">
                <span>{formatTime(savedTime)}</span>
                <span>{formatTime(totalDuration)}</span>
              </div>
            </div>

            <p className="text-blue-200 text-sm font-medium">
              {progress.toFixed(0)}% watched • {formatTime(totalDuration - savedTime)} remaining
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 mb-4">
            {/* Resume Button */}
            <button
              onClick={handleResume}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 shadow-lg"
            >
              <Play size={18} />
              Resume from {formatTime(savedTime)}
            </button>

            {/* Start from Beginning Button */}
            <button
              onClick={handleStart}
              className="w-full bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              Start from Beginning
            </button>
          </div>

          {/* Auto-dismiss timer */}
          <div className="text-center text-gray-400 text-xs">
            Auto-dismiss in {timeLeft}s
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumePrompt;
