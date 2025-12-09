'use client'; // This page needs to be a client component to use Suspense for client components

import React, { Suspense } from 'react';
import ReceiverContent from './ReceiverContent';

const ReceiverPage = () => {
  return (
    <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
            <p>Loading receiver page...</p>
        </div>
    }>
      <ReceiverContent />
    </Suspense>
  );
};

export default ReceiverPage;