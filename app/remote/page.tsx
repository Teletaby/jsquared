'use client'; // This page needs to be a client component to use Suspense for client components

import React, { Suspense } from 'react';
import RemoteContent from './RemoteContent';

const RemotePage = () => {
  return (
    <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
            <p>Loading remote control...</p>
        </div>
    }>
      <RemoteContent />
    </Suspense>
  );
};

export default RemotePage;