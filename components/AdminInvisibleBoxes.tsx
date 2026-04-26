'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Edit2, Plus, Save, Trash2 } from 'lucide-react';
import InvisibleBox from './InvisibleBoxes';

type PageType = 'movie' | 'tv' | 'all';
type PlayerSource = 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock' | 'all';

type Box = {
  _id: string;
  name: string;
  pageType: PageType;
  playerSource: PlayerSource;
  mediaIds: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  action: string;
  customAction?: string;
  cursorStyle?: string;
  clickCount?: number;
  triggerOnLoad?: boolean;
  isActive: boolean;
};

type DraftBox = {
  name: string;
  pageType: PageType;
  playerSource: PlayerSource;
  mediaIds: string;
  x: number;
  y: number;
  width: number;
  height: number;
  action: string;
  customAction: string;
  cursorStyle: string;
  clickCount: number;
  triggerOnLoad: boolean;
};

const ACTION_OPTIONS = [
  { value: 'nextEpisode', label: 'Next Episode' },
  { value: 'previousEpisode', label: 'Previous Episode' },
  { value: 'fullscreen', label: 'Toggle Fullscreen' },
  { value: 'exitFullscreen', label: 'Exit Fullscreen' },
  { value: 'playPause', label: 'Play or Pause' },
  { value: 'mute', label: 'Mute or Unmute' },
  { value: 'skip10s', label: 'Skip +10s' },
  { value: 'rewind10s', label: 'Rewind -10s' },
  { value: 'showSubtitles', label: 'Toggle Subtitles' },
  { value: 'showSettings', label: 'Show Settings' },
  { value: 'click', label: 'Click Player' },
  { value: 'custom', label: 'Custom Event Payload' },
];

const PLAYER_OPTIONS: Array<{ value: PlayerSource; label: string }> = [
  { value: 'all', label: 'All Players' },
  { value: 'videasy', label: 'Player 1 - Videasy' },
  { value: 'vidlink', label: 'Player 2 - VidLink' },
  { value: 'vidnest', label: 'Player 3 - Vidnest' },
  { value: 'vidsrc', label: 'Player 4 - Vidsrc' },
  { value: 'vidrock', label: 'Player 5 - Vidrock' },
];

const CURSOR_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'pointer', label: 'Pointer' },
  { value: 'crosshair', label: 'Crosshair' },
  { value: 'help', label: 'Help' },
  { value: 'wait', label: 'Wait' },
  { value: 'text', label: 'Text' },
  { value: 'move', label: 'Move' },
  { value: 'grab', label: 'Grab' },
  { value: 'not-allowed', label: 'Not Allowed' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' },
];

const emptyDraft: DraftBox = {
  name: '',
  pageType: 'all',
  playerSource: 'all',
  mediaIds: '',
  x: 120,
  y: 120,
  width: 200,
  height: 120,
  action: 'fullscreen',
  customAction: '',
  cursorStyle: 'auto',
  clickCount: 1,
  triggerOnLoad: false,
};

export default function AdminInvisibleBoxes() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftBox>(emptyDraft);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBoxes();
  }, []);

  const fetchBoxes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/invisible-boxes?admin=true');
      if (!res.ok) throw new Error('Failed to load boxes');
      const data = await res.json();
      setBoxes(data.boxes || []);
    } catch (error) {
      console.error('Error fetching boxes:', error);
      alert('Failed to fetch invisible boxes');
    } finally {
      setLoading(false);
    }
  };

  const filteredBoxes = useMemo(() => {
    return boxes.filter((box) => {
      const pageMatch = draft.pageType === 'all' || box.pageType === 'all' || box.pageType === draft.pageType;
      const playerMatch = draft.playerSource === 'all' || box.playerSource === 'all' || box.playerSource === draft.playerSource;
      return pageMatch && playerMatch;
    });
  }, [boxes, draft.pageType, draft.playerSource]);

  const handleAdd = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setShowForm(true);
  };

  const handleEdit = (box: Box) => {
    setEditingId(box._id);
    setDraft({
      name: box.name,
      pageType: box.pageType,
      playerSource: box.playerSource || 'all',
      mediaIds: (box.mediaIds || []).join(','),
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      action: box.action,
      customAction: box.customAction || '',
      cursorStyle: box.cursorStyle || 'auto',
      clickCount: Math.max(1, Number(box.clickCount) || 1),
      triggerOnLoad: Boolean(box.triggerOnLoad),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invisible box?')) return;
    try {
      const res = await fetch(`/api/admin/invisible-boxes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchBoxes();
    } catch (error) {
      console.error(error);
      alert('Failed to delete box');
    }
  };

  const handleToggle = async (box: Box) => {
    try {
      const res = await fetch(`/api/admin/invisible-boxes/${box._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !box.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await fetchBoxes();
    } catch (error) {
      console.error(error);
      alert('Failed to toggle box state');
    }
  };

  const save = async () => {
    if (!draft.name.trim()) {
      alert('Name is required');
      return;
    }

    const mediaIds = draft.mediaIds
      .split(',')
      .map((value) => parseInt(value.trim(), 10))
      .filter((value) => !Number.isNaN(value));

    const payload = {
      name: draft.name.trim(),
      pageType: draft.pageType,
      playerSource: draft.playerSource,
      mediaIds,
      x: Math.max(0, Math.round(draft.x)),
      y: Math.max(0, Math.round(draft.y)),
      width: Math.max(40, Math.round(draft.width)),
      height: Math.max(40, Math.round(draft.height)),
      action: draft.action,
      customAction: draft.action === 'custom' ? draft.customAction : undefined,
      cursorStyle: draft.cursorStyle || 'auto',
      clickCount: Math.max(1, Math.round(draft.clickCount || 1)),
      triggerOnLoad: draft.triggerOnLoad,
    };

    try {
      const url = editingId ? `/api/admin/invisible-boxes/${editingId}` : '/api/admin/invisible-boxes';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save box');

      setShowForm(false);
      setEditingId(null);
      setDraft(emptyDraft);
      await fetchBoxes();
    } catch (error) {
      console.error(error);
      alert('Failed to save box');
    }
  };

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-white">Invisible Boxes</h3>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          New Box
        </button>
      </div>

      {showForm && (
        <div className="p-5 bg-gray-700 rounded-lg border border-gray-600 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 font-semibold mb-2">Box Name</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                placeholder="e.g. Fullscreen Tap Area"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-2">Action</label>
              <select
                value={draft.action}
                onChange={(e) => setDraft((prev) => ({ ...prev, action: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
              >
                {ACTION_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-2">Page Scope</label>
              <select
                value={draft.pageType}
                onChange={(e) => setDraft((prev) => ({ ...prev, pageType: e.target.value as PageType }))}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Pages</option>
                <option value="movie">Movies Only</option>
                <option value="tv">TV Shows Only</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-2">Player Scope</label>
              <select
                value={draft.playerSource}
                onChange={(e) => setDraft((prev) => ({ ...prev, playerSource: e.target.value as PlayerSource }))}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
              >
                {PLAYER_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-300 font-semibold mb-2">Hover Cursor</label>
              <select
                value={draft.cursorStyle}
                onChange={(e) => setDraft((prev) => ({ ...prev, cursorStyle: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
              >
                {CURSOR_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {draft.pageType !== 'all' && (
              <div className="md:col-span-2">
                <label className="block text-gray-300 font-semibold mb-2">Specific Media IDs (optional)</label>
                <input
                  value={draft.mediaIds}
                  onChange={(e) => setDraft((prev) => ({ ...prev, mediaIds: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. 550, 120, 100"
                />
              </div>
            )}

            {draft.action === 'custom' && (
              <div className="md:col-span-2">
                <label className="block text-gray-300 font-semibold mb-2">Custom Payload</label>
                <textarea
                  value={draft.customAction}
                  onChange={(e) => setDraft((prev) => ({ ...prev, customAction: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                  rows={3}
                  placeholder="Any text payload; app receives this in the custom action event"
                />
              </div>
            )}

            <div>
              <label className="block text-gray-300 font-semibold mb-2">Click Count</label>
              <input
                type="number"
                min={1}
                value={draft.clickCount}
                onChange={(e) => setDraft((prev) => ({ ...prev, clickCount: Math.max(1, Number(e.target.value) || 1) }))}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Runs this action multiple times per trigger (for example, 3 = three clicks).</p>
            </div>

            <div className="flex items-center gap-3 mt-8">
              <input
                id="triggerOnLoad"
                type="checkbox"
                checked={draft.triggerOnLoad}
                onChange={(e) => setDraft((prev) => ({ ...prev, triggerOnLoad: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="triggerOnLoad" className="text-gray-300 font-semibold">
                Trigger On Player Load
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-gray-200 font-semibold">Visual Editor (Drag and Resize)</p>
            <p className="text-gray-400 text-sm">Position boxes anywhere on the page, including outside the player. Drag the red box to move. Drag the bottom-right handle to resize. Values update automatically.</p>
            <div
              ref={previewRef}
              className="relative w-full rounded-lg overflow-hidden border border-gray-500"
              style={{
                height: '600px',
                background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
              }}
            >
              {/* Player area representation */}
              <div className="absolute top-16 left-1/2 transform -translate-x-1/2 w-3/4 aspect-video bg-gradient-to-b from-gray-900 to-black border-2 border-gray-600 rounded flex items-center justify-center text-gray-500">
                <span className="text-sm">Player Area</span>
              </div>
              
              <InvisibleBox
                id={editingId || 'draft'}
                x={draft.x}
                y={draft.y}
                width={draft.width}
                height={draft.height}
                action={draft.action}
                customAction={draft.customAction}
                cursorStyle={draft.cursorStyle}
                isDraggable={true}
                isResizable={true}
                showOutline={true}
                allowOutsideContainer={true}
                containerRef={previewRef}
                onPositionChange={(x, y) => setDraft((prev) => ({ ...prev, x, y }))}
                onSizeChange={(width, height) => setDraft((prev) => ({ ...prev, width, height }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-gray-400 text-sm mb-1">X</label>
              <input
                type="number"
                value={draft.x}
                onChange={(e) => setDraft((prev) => ({ ...prev, x: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Y</label>
              <input
                type="number"
                value={draft.y}
                onChange={(e) => setDraft((prev) => ({ ...prev, y: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Width</label>
              <input
                type="number"
                value={draft.width}
                onChange={(e) => setDraft((prev) => ({ ...prev, width: Number(e.target.value) || 40 }))}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Height</label>
              <input
                type="number"
                value={draft.height}
                onChange={(e) => setDraft((prev) => ({ ...prev, height: Number(e.target.value) || 40 }))}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded border border-gray-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              Save
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setDraft(emptyDraft);
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading boxes...</p>
      ) : boxes.length === 0 ? (
        <div className="text-center py-8 bg-gray-700 rounded-lg border border-gray-600">
          <p className="text-gray-400">No invisible boxes yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {boxes.map((box) => (
            <div key={box._id} className="p-4 bg-gray-700 rounded-lg border border-gray-600">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-white font-semibold">{box.name}</p>
                  <p className="text-gray-400 text-sm">
                    Page: {box.pageType} | Player: {box.playerSource || 'all'} | Action: {box.action} | Cursor: {box.cursorStyle || 'auto'} | Clicks: {Math.max(1, Number(box.clickCount) || 1)} | On Load: {box.triggerOnLoad ? 'Yes' : 'No'} | Pos: ({box.x}, {box.y}) | Size: {box.width}x{box.height}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggle(box)}
                    className={`px-3 py-2 rounded font-semibold text-white ${box.isActive ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {box.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleEdit(box)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold flex items-center gap-2"
                  >
                    <Edit2 size={16} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(box._id)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 bg-gray-900 rounded-lg border border-gray-700">
        <p className="text-gray-300 text-sm font-semibold mb-1">Custom action event</p>
        <p className="text-gray-400 text-sm">
          When action is custom, the player dispatches a browser event named jsquared:invisible-box-custom-action with your custom payload.
        </p>
      </div>
    </div>
  );
}
