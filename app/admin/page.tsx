'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner'; // Assuming you have a LoadingSpinner component
import Header from '@/components/Header';
import UserManagement from '@/components/UserManagement';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean | null>(null);
  const [isChatbotMaintenanceMode, setIsChatbotMaintenanceMode] = useState<boolean | null>(null);
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);
  const [errorMaintenance, setErrorMaintenance] = useState<string | null>(null);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [togglingChatbotMaintenance, setTogglingChatbotMaintenance] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || session.user?.role !== 'admin') {
      router.push('/');
    } else {
      fetchMaintenanceStatus();
    }
  }, [session, status, router]);

  const fetchMaintenanceStatus = async () => {
    setLoadingMaintenance(true);
    setErrorMaintenance(null);
    try {
      const res = await fetch('/api/admin/maintenance');
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      const data = await res.json();
      setIsMaintenanceMode(data.isMaintenanceMode);
      setIsChatbotMaintenanceMode(data.isChatbotMaintenanceMode || false);
    } catch (error: any) {
      setErrorMaintenance(error.message);
      console.error('Failed to fetch maintenance status:', error);
    } finally {
      setLoadingMaintenance(false);
    }
  };

  const toggleMaintenanceMode = async () => {
    if (isMaintenanceMode === null) return;

    setTogglingMaintenance(true);
    setErrorMaintenance(null);
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isMaintenanceMode: !isMaintenanceMode }),
      });
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      const data = await res.json();
      setIsMaintenanceMode(data.isMaintenanceMode);
    } catch (error: any) {
      setErrorMaintenance(error.message);
      console.error('Failed to toggle maintenance mode:', error);
    } finally {
      setTogglingMaintenance(false);
    }
  };

  const toggleChatbotMaintenanceMode = async () => {
    if (isChatbotMaintenanceMode === null) return;

    setTogglingChatbotMaintenance(true);
    setErrorMaintenance(null);
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isChatbotMaintenanceMode: !isChatbotMaintenanceMode }),
      });
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      const data = await res.json();
      setIsChatbotMaintenanceMode(data.isChatbotMaintenanceMode);
    } catch (error: any) {
      setErrorMaintenance(error.message);
      console.error('Failed to toggle chatbot maintenance mode:', error);
    } finally {
      setTogglingChatbotMaintenance(false);
    }
  };

  if (status === 'loading' || !session || session.user?.role !== 'admin') {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner />
        <p className="text-xl text-gray-500 ml-4">Loading or Access Denied...</p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 pt-24">
        <h1 className="text-3xl font-bold mb-6 text-white">Admin Panel</h1>
        <p className="text-gray-300">Welcome, {session.user?.name || session.user?.email}!</p>

        <section className="mt-8 p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-white">Maintenance Tools</h2>
          <p className="text-gray-400 mb-4">Manage site-wide maintenance mode.</p>

          {loadingMaintenance ? (
            <div className="flex items-center">
              <LoadingSpinner />
              <p className="text-gray-400 ml-2">Loading maintenance status...</p>
            </div>
          ) : errorMaintenance ? (
            <p className="text-red-500">Error: {errorMaintenance}</p>
          ) : (
            <div>
              <div className="mb-6">
                <p className="text-gray-300 mb-4">
                  Website Status: <span className={`font-bold ${isMaintenanceMode ? 'text-red-500' : 'text-green-500'}`}>
                    {isMaintenanceMode ? 'UNDER MAINTENANCE' : 'OPERATIONAL'}
                  </span>
                </p>
                <button
                  onClick={toggleMaintenanceMode}
                  disabled={togglingMaintenance}
                  className={`px-6 py-3 rounded-lg text-white font-semibold transition-colors duration-200 flex items-center gap-2
                    ${isMaintenanceMode
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'}
                    ${togglingMaintenance ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {togglingMaintenance && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  {isMaintenanceMode ? 'Deactivate Maintenance Mode' : 'Activate Maintenance Mode'}
                </button>
              </div>

              <div className="border-t border-gray-700 pt-6">
                <p className="text-gray-300 mb-4">
                  Chatbot Status: <span className={`font-bold ${isChatbotMaintenanceMode ? 'text-red-500' : 'text-green-500'}`}>
                    {isChatbotMaintenanceMode ? 'UNDER MAINTENANCE' : 'OPERATIONAL'}
                  </span>
                </p>
                <button
                  onClick={toggleChatbotMaintenanceMode}
                  disabled={togglingChatbotMaintenance}
                  className={`px-6 py-3 rounded-lg text-white font-semibold transition-colors duration-200 flex items-center gap-2
                    ${isChatbotMaintenanceMode
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'}
                    ${togglingChatbotMaintenance ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {togglingChatbotMaintenance && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  {isChatbotMaintenanceMode ? 'Deactivate Chatbot Maintenance' : 'Activate Chatbot Maintenance'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="mt-8 p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-white">User Management</h2>
          <p className="text-gray-400 mb-4">View and manage user accounts.</p>
          <UserManagement />
        </section>

        <section className="mt-8 p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-white">System Status</h2>
          <p className="text-gray-400">Monitor application health and performance (coming soon).</p>
        </section>
      </div>
    </>
  );
}