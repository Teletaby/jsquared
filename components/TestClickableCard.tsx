"use client";

import React from 'react';
import MediaCard, { Media } from './MediaCard';

const TestClickableCard: React.FC = () => {
  const dummyMedia: Media = {
    id: 12345,
    title: 'Test Movie',
    overview: 'This is a test movie overview.',
    poster_path: '/kqjL17yufvn9OVLyXYpvZfXrZhp.jpg', // Example poster path
    vote_average: 7.5,
    media_type: 'movie',
  };

  const handleTestClick = () => {
    console.log('TestClickableCard: Parent div clicked!');
    alert('Parent div clicked!');
  };

  return (
    <div className="p-4">
      <h2 className="text-white text-2xl mb-4">Test Clickable Card</h2>
      <div className="w-1/3"> {/* Limit width to make it visible */}
        <MediaCard media={dummyMedia} onClick={handleTestClick} />
      </div>
    </div>
  );
};

export default TestClickableCard;
