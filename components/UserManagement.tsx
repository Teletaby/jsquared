'use client';

import { useState, useEffect } from 'react';
import { Trash2, Edit2, X, Check } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface User {
  _id: string;
  email: string;
  name: string | null;
  username: string | null;
  role: 'user' | 'admin';
  provider: 'google' | 'credentials';
  createdAt: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<'user' | 'admin' | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch users');
      }
      
      setUsers(data);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'user' | 'admin') => {
    setUpdating(userId);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update user');
      }
      
      setUsers(users.map(u => u._id === userId ? data : u));
      setEditingId(null);
      setEditingRole(null);
    } catch (err: any) {
      console.error('Error updating user:', err);
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    setDeleting(userId);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete user');
      }
      
      setUsers(users.filter(u => u._id !== userId));
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
        <p className="text-gray-400 ml-2">Loading users...</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-400">
          <thead className="text-xs uppercase bg-gray-700 text-gray-300">
            <tr>
              <th className="px-6 py-3 text-left">Email</th>
              <th className="px-6 py-3 text-left">Name</th>
              <th className="px-6 py-3 text-left">Provider</th>
              <th className="px-6 py-3 text-left">Role</th>
              <th className="px-6 py-3 text-left">Joined</th>
              <th className="px-6 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user._id} className="border-b border-gray-700 hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-3">{user.email}</td>
                  <td className="px-6 py-3">{user.name || '-'}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-block px-2 py-1 text-xs rounded ${
                      user.provider === 'google' 
                        ? 'bg-red-500/20 text-red-300' 
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {user.provider}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {editingId === user._id ? (
                      <select
                        value={editingRole || user.role}
                        onChange={(e) => setEditingRole(e.target.value as 'user' | 'admin')}
                        className="bg-gray-700 text-white px-2 py-1 rounded text-xs"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`inline-block px-2 py-1 text-xs rounded ${
                        user.role === 'admin' 
                          ? 'bg-purple-500/20 text-purple-300' 
                          : 'bg-gray-600/20 text-gray-300'
                      }`}>
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-xs">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {editingId === user._id ? (
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleUpdateRole(user._id, editingRole || user.role)}
                          disabled={updating === user._id}
                          className="text-green-500 hover:text-green-400 disabled:opacity-50"
                        >
                          {updating === user._id ? <LoadingSpinner size={16} /> : <Check size={16} />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-400 hover:text-gray-300"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingId(user._id);
                            setEditingRole(user.role);
                          }}
                          className="text-blue-500 hover:text-blue-400 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user._id)}
                          disabled={deleting === user._id}
                          className="text-red-500 hover:text-red-400 disabled:opacity-50 transition-colors"
                        >
                          {deleting === user._id ? <LoadingSpinner size={16} /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-gray-500">Total Users: {users.length}</p>
    </div>
  );
}
