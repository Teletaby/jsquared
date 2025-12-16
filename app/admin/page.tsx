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
  const [isLoggingEnabled, setIsLoggingEnabled] = useState<boolean | null>(null);
  const [videoSource, setVideoSource] = useState<'videasy' | 'vidlink' | 'vidsrc' | null>(null);
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);
  const [loadingLogging, setLoadingLogging] = useState(true);
  const [loadingVisitorLogs, setLoadingVisitorLogs] = useState(true);
  const [errorMaintenance, setErrorMaintenance] = useState<string | null>(null);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [togglingChatbotMaintenance, setTogglingChatbotMaintenance] = useState(false);
  const [togglingLogging, setTogglingLogging] = useState(false);
  const [togglingVideoSource, setTogglingVideoSource] = useState(false);
  const [visitorLogs, setVisitorLogs] = useState<any[]>([]);
  const [visitorLogsCount, setVisitorLogsCount] = useState(0);
  const [clearingLogs, setClearingLogs] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || session.user?.role !== 'admin') {
      router.push('/');
    } else {
      fetchMaintenanceStatus();
      fetchLoggingStatus();
      fetchVisitorLogs();
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
      setVideoSource(data.videoSource || 'videasy');
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

  const toggleVideoSource = async () => {
    if (videoSource === null) return;

    // Cycle through sources: videasy -> vidlink -> vidsrc -> videasy
    let newSource: 'videasy' | 'vidlink' | 'vidsrc';
    if (videoSource === 'videasy') {
      newSource = 'vidlink';
    } else if (videoSource === 'vidlink') {
      newSource = 'vidsrc';
    } else {
      newSource = 'videasy';
    }

    setTogglingVideoSource(true);
    setErrorMaintenance(null);
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoSource: newSource }),
      });
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      const data = await res.json();
      setVideoSource(data.videoSource);
    } catch (error: any) {
      setErrorMaintenance(error.message);
      console.error('Failed to toggle video source:', error);
    } finally {
      setTogglingVideoSource(false);
    }
  };

  const fetchLoggingStatus = async () => {
    setLoadingLogging(true);
    try {
      const res = await fetch('/api/admin/logging');
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      const data = await res.json();
      setIsLoggingEnabled(data.isLoggingEnabled);
    } catch (error: any) {
      setIsLoggingEnabled(true); // Default to enabled
    } finally {
      setLoadingLogging(false);
    }
  };

  const toggleLogging = async () => {
    if (isLoggingEnabled === null) return;

    setTogglingLogging(true);
    try {
      const res = await fetch('/api/admin/logging', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isLoggingEnabled: !isLoggingEnabled }),
      });
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      const data = await res.json();
      setIsLoggingEnabled(data.isLoggingEnabled);
    } catch (error: any) {
    } finally {
      setTogglingLogging(false);
    }
  };

  const fetchVisitorLogs = async () => {
    setLoadingVisitorLogs(true);
    try {
      const res = await fetch('/api/admin/visitor-logs?limit=20&page=1');
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      const data = await res.json();
      setVisitorLogs(data.logs || []);
      setVisitorLogsCount(data.pagination?.totalCount || 0);
    } catch (error: any) {
      setVisitorLogs([]);
      setVisitorLogsCount(0);
    } finally {
      setLoadingVisitorLogs(false);
    }
  };

  const clearVisitorLogs = async () => {
    if (!confirm('Are you sure you want to delete ALL visitor logs? This action cannot be undone.')) {
      return;
    }

    setClearingLogs(true);
    try {
      const res = await fetch('/api/admin/visitor-logs/delete', {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      const data = await res.json();
      setVisitorLogs([]);
      setVisitorLogsCount(0);
      alert(`Successfully deleted ${data.deletedCount} logs`);
    } catch (error: any) {
      alert('Failed to clear logs');
    } finally {
      setClearingLogs(false);
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

              <div className="border-t border-gray-700 pt-6">
                <p className="text-gray-300 mb-4">
                  Video Source: <span className={`font-bold ${
                    videoSource === 'videasy' ? 'text-blue-500' :
                    videoSource === 'vidlink' ? 'text-green-500' :
                    'text-yellow-500'
                  }`}>
                    {videoSource === 'videasy' ? 'VIDEASY (Source 1)' : 
                     videoSource === 'vidlink' ? 'VIDLINK (Source 2)' :
                     'VIDSRC (Source 3)'}
                  </span>
                </p>
                <p className="text-gray-400 text-sm mb-4">
                  {videoSource === 'videasy'
                    ? 'Currently using Videasy - Full progress tracking enabled'
                    : videoSource === 'vidlink'
                    ? 'Currently using VidLink - Full progress tracking enabled'
                    : 'Currently using VidSrc - Watch history only (no progress saving)'}
                </p>
                <button
                  onClick={toggleVideoSource}
                  disabled={togglingVideoSource}
                  className={`px-6 py-3 rounded-lg text-white font-semibold transition-colors duration-200 flex items-center gap-2
                    ${videoSource === 'videasy'
                      ? 'bg-green-600 hover:bg-green-700'
                      : videoSource === 'vidlink'
                      ? 'bg-yellow-600 hover:bg-yellow-700'
                      : 'bg-blue-600 hover:bg-blue-700'}
                    ${togglingVideoSource ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {togglingVideoSource && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  Switch to {videoSource === 'videasy' ? 'VIDLINK' : videoSource === 'vidlink' ? 'VIDSRC' : 'VIDEASY'}
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

        <section className="mt-8 p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-white">Logging & Analytics</h2>
          <p className="text-gray-400 mb-6">Manage visitor log collection and analytics tracking.</p>

          {loadingLogging ? (
            <div className="flex items-center">
              <LoadingSpinner />
              <p className="text-gray-400 ml-2">Loading logging status...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-gray-300">
                      Logging Status: <span className={`font-bold ${isLoggingEnabled ? 'text-green-500' : 'text-red-500'}`}>
                        {isLoggingEnabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </p>
                    <p className="text-gray-400 text-sm mt-2">Tracks visitor IP, browser, ISP, timestamps, and page interactions</p>
                  </div>
                  <button
                    onClick={toggleLogging}
                    disabled={togglingLogging}
                    className={`px-6 py-3 rounded-lg text-white font-semibold transition-colors duration-200 flex items-center gap-2
                      ${isLoggingEnabled
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700'}
                      ${togglingLogging ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {togglingLogging && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    {isLoggingEnabled ? 'Disable Logging' : 'Enable Logging'}
                  </button>
                </div>

                {/* Visitor Logs Display */}
                <div className="border-t border-gray-700 pt-6 mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white">Visitor Logs</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={fetchVisitorLogs}
                        disabled={loadingVisitorLogs}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors duration-200 flex items-center gap-2"
                      >
                        {loadingVisitorLogs && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        Refresh Logs
                      </button>
                      <button
                        onClick={clearVisitorLogs}
                        disabled={clearingLogs}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors duration-200 flex items-center gap-2"
                      >
                        {clearingLogs && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        Clear All Logs
                      </button>
                    </div>
                  </div>

                  {loadingVisitorLogs ? (
                    <div className="flex items-center">
                      <LoadingSpinner />
                      <p className="text-gray-400 ml-2">Loading visitor logs...</p>
                    </div>
                  ) : visitorLogs.length > 0 ? (
                    <div className="overflow-x-auto bg-gray-900 rounded-lg">
                      <table className="w-full text-sm text-gray-300">
                        <thead className="bg-gray-700 border-b border-gray-600">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">IP Address</th>
                            <th className="px-4 py-3 text-left font-semibold">Browser</th>
                            <th className="px-4 py-3 text-left font-semibold">Operating System</th>
                            <th className="px-4 py-3 text-left font-semibold">Page URL</th>
                            <th className="px-4 py-3 text-left font-semibold">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visitorLogs.map((log: any, index: number) => (
                            <tr key={index} className="border-b border-gray-700 hover:bg-gray-800 transition-colors">
                              <td className="px-4 py-3 font-mono text-gray-400">{log.ipAddress || 'N/A'}</td>
                              <td className="px-4 py-3">{log.browser || 'Unknown'}</td>
                              <td className="px-4 py-3">{log.os || 'Unknown'}</td>
                              <td className="px-4 py-3 truncate max-w-xs">{log.url || 'N/A'}</td>
                              <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                                {log.timestamp 
                                  ? new Date(log.timestamp).toLocaleString()
                                  : 'N/A'
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-4 py-3 bg-gray-900 border-t border-gray-700 text-gray-400 text-sm">
                        Total Visitors: <span className="font-bold text-white">{visitorLogsCount}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-900 rounded-lg">
                      <p className="text-gray-400">No visitor logs found</p>
                      <p className="text-gray-500 text-sm mt-2">Logs will appear here when visitors browse your site</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}