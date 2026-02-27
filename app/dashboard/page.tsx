'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import UserWatchHistory from '@/components/UserWatchHistory';
import Header from '@/components/Header';
import { Plus, X, Folder } from 'lucide-react';

// Force recompile

interface UserProfile {
  name?: string;
  email?: string;
  image?: string;
}

interface WatchHistoryItem {
  _id: string;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string;
  progress: number;
  currentTime: number;
  totalDuration: number;
  totalPlayedSeconds?: number;
  lastWatchedAt: string;
}

interface WatchlistItem {
  _id: string;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string;
  rating?: number;
  folderId?: string;
  addedAt: string;
}

interface WatchlistFolder {
  _id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
}

interface WatchHistoryStats {
  totalItems: number;
  totalHoursWatched: number;
}

const DashboardPage = () => {
  const { data: session } = useSession();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [folders, setFolders] = useState<WatchlistFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [watchHistoryStats, setWatchHistoryStats] = useState<WatchHistoryStats>({ totalItems: 0, totalHoursWatched: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [selectedFolderForAdd, setSelectedFolderForAdd] = useState<string | null>(null);
  const [selectedItemsForFolder, setSelectedItemsForFolder] = useState<Set<string>>(new Set());
  const [addingItems, setAddingItems] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const user = session?.user as UserProfile | undefined;

  useEffect(() => {
    if (!session?.user) return;

    const fetchFolders = async () => {
      try {
        const response = await fetch('/api/watchlist-folders');
        if (response.ok) {
          const data = await response.json();
          setFolders(data);
        }
      } catch (error) {
        console.error('Error fetching folders:', error);
      } finally {
        setLoadingFolders(false);
      }
    };

    const fetchWatchlist = async () => {
      try {
        const response = await fetch('/api/watchlist');
        if (response.ok) {
          const data = await response.json();
          setWatchlist(data);
        }
      } catch (error) {
        console.error('Error fetching watchlist:', error);
      } finally {
        setLoadingWatchlist(false);
      }
    };

    fetchFolders();
    fetchWatchlist();
  }, [session]);

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    try {
      const response = await fetch('/api/watchlist-folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });

      if (response.ok) {
        const newFolder = await response.json();
        setFolders([newFolder, ...folders]);
        setNewFolderName('');
        setShowNewFolderModal(false);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create folder');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Error creating folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const deleteFolder = async (folderId: string) => {
    setFolderToDelete(folderId);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;

    setDeletingFolder(true);
    try {
      const response = await fetch(`/api/watchlist-folders/${folderToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFolders(folders.filter((f) => f._id !== folderToDelete));
        setShowDeleteConfirmModal(false);
        setFolderToDelete(null);
        setSuccessMessage('Folder deleted successfully!');
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), 3000);
      } else {
        setSuccessMessage('Failed to delete folder');
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), 3000);
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      setSuccessMessage('Error deleting folder');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 3000);
    } finally {
      setDeletingFolder(false);
    }
  };

  const moveToFolder = async (mediaId: number, mediaType: 'movie' | 'tv', folderId: string | null) => {
    try {
      const response = await fetch('/api/watchlist/move', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mediaId, mediaType, folderId }),
      });

      if (response.ok) {
        const updatedItem = await response.json();
        // Update the watchlist state
        setWatchlist((prevWatchlist) =>
          prevWatchlist.map((item) =>
            item.mediaId === mediaId && item.mediaType === mediaType
              ? { ...item, folderId: updatedItem.folderId }
              : item
          )
        );
      } else {
        alert('Failed to move item');
      }
    } catch (error) {
      console.error('Error moving item:', error);
      alert('Error moving item');
    }
  };

  const openAddItemsModal = (folderId: string) => {
    setSelectedFolderForAdd(folderId);
    setSelectedItemsForFolder(new Set());
    setShowAddItemsModal(true);
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItemsForFolder);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItemsForFolder(newSelected);
  };

  const addItemsToFolder = async () => {
    if (!selectedFolderForAdd || selectedItemsForFolder.size === 0) return;

    setAddingItems(true);
    try {
      const itemsToAdd = Array.from(selectedItemsForFolder);
      let allSuccessful = true;
      
      // Move all selected items to the folder
      for (const itemId of itemsToAdd) {
        const item = watchlist.find((w) => w._id === itemId);
        if (item) {
          const response = await fetch('/api/watchlist/move', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              mediaId: item.mediaId,
              mediaType: item.mediaType,
              folderId: selectedFolderForAdd,
            }),
          });

          if (!response.ok) {
            console.error(`Failed to move item ${itemId}:`, response.statusText);
            allSuccessful = false;
          }
        }
      }

      if (!allSuccessful) {
        setSuccessMessage('Some items failed to add. Please try again.');
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), 3000);
        setAddingItems(false);
        return;
      }

      // Update local state
      setWatchlist((prevWatchlist) =>
        prevWatchlist.map((item) =>
          selectedItemsForFolder.has(item._id)
            ? { ...item, folderId: selectedFolderForAdd }
            : item
        )
      );

      setShowAddItemsModal(false);
      setSelectedItemsForFolder(new Set());
      setSuccessMessage('Items added to folder successfully!');
      setShowSuccessModal(true);
      // Auto-close the modal after 3 seconds
      setTimeout(() => setShowSuccessModal(false), 3000);
    } catch (error) {
      console.error('Error adding items to folder:', error);
      setSuccessMessage('Error adding items to folder');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 3000);
    } finally {
      setAddingItems(false);
    }
  };

  useEffect(() => {
    if (!session?.user) return;

    const fetchWatchlist = async () => {
      try {
        const response = await fetch('/api/watchlist');
        if (response.ok) {
          const data = await response.json();
          setWatchlist(data);
        }
      } catch (error) {
        console.error('Error fetching watchlist:', error);
      } finally {
        setLoadingWatchlist(false);
      }
    };

    fetchWatchlist();
  }, [session]);

  const handleRemoveFromWatchlist = async (e: React.MouseEvent, mediaId: number, mediaType: 'movie' | 'tv') => {
    e.preventDefault(); // Prevent navigating to the media detail page
    e.stopPropagation(); // Stop event propagation

    try {
      const response = await fetch('/api/watchlist', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mediaId, mediaType }),
      });

      if (response.ok) {
        setWatchlist((prevWatchlist) =>
          prevWatchlist.filter((item) => !(item.mediaId === mediaId && item.mediaType === mediaType))
        );
        console.log('Item removed from watchlist successfully');
      } else {
        console.error('Failed to remove item from watchlist:', response.statusText);
      }
    } catch (error) {
      console.error('Error removing item from watchlist:', error);
    }
  };

  useEffect(() => {
    if (!session?.user) return;

    const fetchWatchHistoryStats = async () => {
      try {
        const response = await fetch('/api/watch-history');
        if (response.ok) {
          const data: WatchHistoryItem[] = await response.json();
          const totalItems = data.length;
          const totalSeconds = data.reduce((sum, item) => sum + (item.totalPlayedSeconds || 0), 0);
          const totalHours = Math.floor(totalSeconds / 3600);
          const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
          const totalHoursWatched = totalHours + (totalMinutes / 60);
          
          setWatchHistoryStats({
            totalItems,
            totalHoursWatched: totalHoursWatched,
          });
        }
      } catch (error) {
        console.error('Error fetching watch history stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchWatchHistoryStats();
  }, [session]);

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 font-orbitron uppercase tracking-wider">Please sign in to access your dashboard</h1>
          <Link href="/signin" className="inline-block bg-[#E50914] text-white px-8 py-3 rounded-lg hover:bg-[#FF1A20] transition-colors font-bold">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background text-white">
        <main className="container mx-auto py-8 px-4 pt-24">
          {/* User Profile Section */}
          <div className="mb-16 flex items-center gap-8 rounded-xl bg-gradient-to-r from-[#E50914]/20 to-[#1A1A1A] p-8 shadow-2xl border border-[#E50914]/30">
            <div 
              className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-full border-4 border-[#E50914] shadow-lg shadow-[#E50914]/50"
            >
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user?.name || 'User'}
                  fill
                  className="object-cover object-center"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#E50914] text-4xl font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2 font-orbitron uppercase tracking-wider">{user?.name || 'Welcome'}</h1>
              <p className="text-gray-400 text-lg mb-6">{user?.email}</p>
              {(session?.user as any)?.role === 'admin' && (
                <div className="mt-4 flex gap-4 text-sm flex-wrap">
                  <span className="bg-[#E50914]/20 border border-[#E50914]/50 px-4 py-2 rounded-lg text-[#E50914] font-bold">
                    Watch History: {loadingStats ? 'Loading...' : `${watchHistoryStats.totalItems} items`}
                  </span>
                  <span className="bg-[#E50914]/20 border border-[#E50914]/50 px-4 py-2 rounded-lg text-[#E50914] font-bold">
                    Hours Watched: {loadingStats ? 'Loading...' : `${Math.floor(watchHistoryStats.totalHoursWatched)}h ${Math.round((watchHistoryStats.totalHoursWatched % 1) * 60)}m`}
                  </span>
                  <span className="bg-[#E50914]/20 border border-[#E50914]/50 px-4 py-2 rounded-lg text-[#E50914] font-bold">Watchlist: {watchlist.length} items</span>
                </div>
              )}
            </div>
          </div>

          {/* Continue Watching Section */}
          <section className="mb-16">
            <Suspense fallback={<div className="text-white text-center">Loading watch history...</div>}>
              <UserWatchHistory />
            </Suspense>
          </section>

          {/* Watchlist Section with Folders */}
          <section className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-[#E50914] rounded-full"></div>
                <h2 className="text-3xl font-bold text-white font-orbitron uppercase tracking-wider">My Watchlist</h2>
              </div>
              <button
                onClick={() => setShowNewFolderModal(true)}
                className="flex items-center gap-2 bg-[#E50914] hover:bg-[#FF1A20] text-white px-4 py-2 rounded-lg transition-colors font-bold"
              >
                <Plus size={20} />
                New Folder
              </button>
            </div>

            {/* New Folder Modal */}
            {showNewFolderModal && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">Create New Folder</h3>
                    <button
                      onClick={() => setShowNewFolderModal(false)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <form onSubmit={createFolder} className="space-y-4">
                    <input
                      type="text"
                      placeholder="Folder name (e.g., Action Movies, Watch Later)"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-[#E50914]"
                      autoFocus
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowNewFolderModal(false)}
                        className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creatingFolder || !newFolderName.trim()}
                        className="flex-1 px-4 py-2 rounded-lg bg-[#E50914] hover:bg-[#FF1A20] disabled:bg-gray-600 text-white transition-colors font-bold"
                      >
                        {creatingFolder ? 'Creating...' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Add Items to Folder Modal */}
            {showAddItemsModal && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
                  <div className="sticky top-0 bg-gray-800 flex items-center justify-between p-6 border-b border-gray-700 z-10">
                    <h3 className="text-xl font-bold text-white">
                      Add Items to Folder • <span style={{ color: folders.find((f) => f._id === selectedFolderForAdd)?.color }}>{folders.find((f) => f._id === selectedFolderForAdd)?.name}</span>
                    </h3>
                    <button
                      onClick={() => {
                        setShowAddItemsModal(false);
                        setSelectedItemsForFolder(new Set());
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Show items that are not in this folder */}
                    {watchlist
                      .filter((item) => !item.folderId || item.folderId !== selectedFolderForAdd)
                      .length === 0 ? (
                      <p className="text-gray-400 text-center py-8">All watchlist items are already in this folder</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {watchlist
                          .filter((item) => !item.folderId || item.folderId !== selectedFolderForAdd)
                          .map((item) => (
                            <div key={item._id} className="relative cursor-pointer">
                              <div
                                onClick={() => toggleItemSelection(item._id)}
                                className={`relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                  selectedItemsForFolder.has(item._id)
                                    ? 'border-[#E50914] shadow-lg shadow-[#E50914]/50'
                                    : 'border-gray-700 hover:border-gray-600'
                                }`}
                              >
                                {item.posterPath && (
                                  <Image
                                    src={`https://image.tmdb.org/t/p/w200${item.posterPath}`}
                                    alt={item.title}
                                    fill
                                    className="object-cover"
                                  />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80" />
                                <div className="absolute bottom-0 left-0 right-0 p-2">
                                  <p className="truncate text-xs font-bold text-white line-clamp-2">{item.title}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="sticky bottom-0 bg-gray-800 flex gap-3 p-6 border-t border-gray-700 z-10">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddItemsModal(false);
                        setSelectedItemsForFolder(new Set());
                      }}
                      className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addItemsToFolder}
                      disabled={addingItems || selectedItemsForFolder.size === 0}
                      className="flex-1 px-4 py-2 rounded-lg bg-[#E50914] hover:bg-[#FF1A20] disabled:bg-gray-600 text-white transition-colors font-bold"
                    >
                      {addingItems ? 'Adding...' : `Add ${selectedItemsForFolder.size} Item${selectedItemsForFolder.size !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full border border-gray-700 text-center animate-in fade-in duration-300">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Success!</h3>
                  <p className="text-gray-400">{successMessage}</p>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirmModal && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full border border-gray-700">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3 text-center">Delete Folder?</h3>
                  <p className="text-gray-400 text-center mb-6">Are you sure you want to delete this folder? Items will remain in your watchlist.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowDeleteConfirmModal(false);
                        setFolderToDelete(null);
                      }}
                      disabled={deletingFolder}
                      className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 text-white transition-colors font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDeleteFolder}
                      disabled={deletingFolder}
                      className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white transition-colors font-bold"
                    >
                      {deletingFolder ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loadingFolders || loadingWatchlist ? (
              <div className="text-center text-gray-400">Loading watchlist...</div>
            ) : folders.length === 0 && watchlist.filter((item) => !item.folderId).length === 0 ? (
              <div className="text-center text-gray-400 py-12 border border-gray-700 rounded-xl">
                <p className="mb-4 text-lg">No items in your watchlist yet</p>
                <Link href="/movies" className="inline-block bg-[#E50914] text-white px-6 py-2 rounded-lg hover:bg-[#FF1A20] transition-colors font-bold">
                  Explore Movies
                </Link>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Unsorted Items */}
                {watchlist.filter((item) => !item.folderId).length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-300 mb-4 flex items-center gap-2">
                      <Folder size={20} />
                      Unsorted
                    </h3>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {watchlist
                        .filter((item) => !item.folderId)
                        .map((item) => (
                          <div key={item._id} className="relative group overflow-hidden rounded-xl">
                            <Link
                              href={`/${item.mediaType}/${item.mediaId}`}
                              className="block transition-transform duration-300 hover:scale-105 h-full"
                            >
                              <div className="relative aspect-[2/3] bg-gray-800">
                                {item.posterPath && (
                                  <Image
                                    src={`https://image.tmdb.org/t/p/w200${item.posterPath}`}
                                    alt={item.title}
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                                  />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 group-hover:to-black/90 transition-all duration-300" />
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 p-3">
                                <p className="truncate text-xs font-bold text-white font-orbitron uppercase tracking-wide line-clamp-2">{item.title}</p>
                                {item.rating && <p className="text-xs text-[#E50914] font-bold mt-1">★ {item.rating.toFixed(1)}</p>}
                              </div>
                            </Link>
                            {/* Action Buttons */}
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
                              {/* Remove Button */}
                              <button
                                onClick={(e) => handleRemoveFromWatchlist(e, item.mediaId, item.mediaType)}
                                className="bg-[#E50914] hover:bg-[#FF1A20] p-2 rounded-full text-white"
                                aria-label="Remove from watchlist"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Folders */}
                {folders.map((folder) => {
                  const folderItems = watchlist.filter((item) => item.folderId === folder._id);
                  return (
                    <div key={folder._id}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-300 flex items-center gap-2">
                          <Folder size={20} style={{ color: folder.color }} />
                          {folder.name}
                          <span className="text-sm font-normal text-gray-500">({folderItems.length})</span>
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openAddItemsModal(folder._id)}
                            className="text-gray-400 hover:text-green-500 transition-colors p-2"
                            title="Add items to folder"
                          >
                            <Plus size={20} />
                          </button>
                          <button
                            onClick={() => deleteFolder(folder._id)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-2"
                            title="Delete folder"
                          >
                            <X size={20} />
                          </button>
                        </div>
                      </div>
                      {folderItems.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 border border-dashed border-gray-700 rounded-lg">
                          <p>No items in this folder</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                          {folderItems.map((item) => (
                            <div key={item._id} className="relative group overflow-hidden rounded-xl">
                              <Link
                                href={`/${item.mediaType}/${item.mediaId}`}
                                className="block transition-transform duration-300 hover:scale-105 h-full"
                              >
                                <div className="relative aspect-[2/3] bg-gray-800">
                                  {item.posterPath && (
                                    <Image
                                      src={`https://image.tmdb.org/t/p/w200${item.posterPath}`}
                                      alt={item.title}
                                      fill
                                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                                    />
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 group-hover:to-black/90 transition-all duration-300" />
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 p-3">
                                  <p className="truncate text-xs font-bold text-white font-orbitron uppercase tracking-wide line-clamp-2">{item.title}</p>
                                  {item.rating && <p className="text-xs text-[#E50914] font-bold mt-1">★ {item.rating.toFixed(1)}</p>}
                                </div>
                              </Link>
                              {/* Action Buttons */}
                              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
                                {/* Remove Button */}
                                <button
                                  onClick={(e) => handleRemoveFromWatchlist(e, item.mediaId, item.mediaType)}
                                  className="bg-[#E50914] hover:bg-[#FF1A20] p-2 rounded-full text-white"
                                  aria-label="Remove from watchlist"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
      

    </>
  );
};

export default DashboardPage;
