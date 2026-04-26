'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import InvisibleBox from './InvisibleBoxes';

type PlayerSource = 'videasy' | 'vidlink' | 'vidnest' | 'vidsrc' | 'vidrock';
type MediaType = 'movie' | 'tv';

type EditorBox = {
  _id: string;
  name: string;
  pageType: 'movie' | 'tv' | 'all';
  playerSource: PlayerSource | 'all';
  mediaIds: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  action: string;
  customAction?: string;
  clickCount?: number;
  triggerOnLoad?: boolean;
  isActive: boolean;
  isNew?: boolean;
};

const ACTIONS = [
  'nextEpisode',
  'previousEpisode',
  'fullscreen',
  'exitFullscreen',
  'playPause',
  'mute',
  'skip10s',
  'rewind10s',
  'showSubtitles',
  'showSettings',
  'click',
  'custom',
];

interface InlineInvisibleBoxEditorProps {
  mediaId: number;
  mediaType: MediaType;
  playerSource: PlayerSource;
  containerRef: React.RefObject<HTMLElement | null>;
  triggeredBox?: { name: string; action: string; triggerSource: 'click' | 'load' } | null;
}

export default function InlineInvisibleBoxEditor({
  mediaId,
  mediaType,
  playerSource,
  containerRef,
  triggeredBox,
}: InlineInvisibleBoxEditorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [boxes, setBoxes] = useState<EditorBox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullscreenHost, setFullscreenHost] = useState<HTMLElement | null>(null);
  const [buttonPos, setButtonPos] = useState({ x: 0, y: 0 });
  const [draggingButton, setDraggingButton] = useState(false);
  const dragState = useState({
    pointerId: -1,
    startPointerX: 0,
    startPointerY: 0,
    startButtonX: 0,
    startButtonY: 0,
    moved: false,
  })[0];

  const BUTTON_WIDTH = 124;
  const BUTTON_HEIGHT = 40;

  const clampButtonPos = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };

    const maxX = Math.max(8, window.innerWidth - BUTTON_WIDTH - 8);
    const maxY = Math.max(8, window.innerHeight - BUTTON_HEIGHT - 8);

    return {
      x: Math.min(Math.max(8, x), maxX),
      y: Math.min(Math.max(8, y), maxY),
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (buttonPos.x !== 0 || buttonPos.y !== 0) return;

    const initialX = Math.max(8, window.innerWidth - BUTTON_WIDTH - 20);
    const initialY = Math.max(8, window.innerHeight - BUTTON_HEIGHT - 20);
    setButtonPos({ x: initialX, y: initialY });
  }, [buttonPos.x, buttonPos.y]);

  useEffect(() => {
    const onResize = () => {
      setButtonPos((prev) => clampButtonPos(prev.x, prev.y));
    };

    const syncFullscreenHost = () => {
      const fsEl = document.fullscreenElement;
      const root = containerRef.current;

      if (fsEl && root && root.contains(fsEl) && fsEl instanceof HTMLElement) {
        setFullscreenHost(fsEl);
      } else {
        setFullscreenHost(null);
      }
    };

    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onResize);
    document.addEventListener('fullscreenchange', syncFullscreenHost);
    syncFullscreenHost();

    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onResize);
      document.removeEventListener('fullscreenchange', syncFullscreenHost);
    };
  }, [clampButtonPos, containerRef]);

  const selectedBox = useMemo(
    () => boxes.find((box) => box._id === selectedId) || null,
    [boxes, selectedId]
  );

  const fetchBoxes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        admin: 'true',
        pageType: mediaType,
        mediaId: String(mediaId),
        playerSource,
      });
      const res = await fetch(`/api/admin/invisible-boxes?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load boxes');
      const data = await res.json();
      const loaded: EditorBox[] = (data.boxes || []).map((box: any) => ({
        ...box,
        playerSource: box.playerSource || 'all',
        mediaIds: Array.isArray(box.mediaIds) ? box.mediaIds : [],
        clickCount: Math.max(1, Number(box.clickCount) || 1),
        triggerOnLoad: Boolean(box.triggerOnLoad),
      }));
      setBoxes(loaded);
      setSelectedId(loaded[0]?._id || null);
    } catch (error) {
      console.error('Inline editor load failed:', error);
    } finally {
      setLoading(false);
    }
  }, [mediaId, mediaType, playerSource]);

  useEffect(() => {
    if (open) {
      fetchBoxes();
    }
  }, [open, fetchBoxes]);

  const updateBox = (id: string, patch: Partial<EditorBox>) => {
    setBoxes((prev) => prev.map((box) => (box._id === id ? { ...box, ...patch } : box)));
  };

  const addBox = () => {
    const id = `new-${Date.now()}`;
    const newBox: EditorBox = {
      _id: id,
      name: `Box ${boxes.length + 1}`,
      pageType: mediaType,
      playerSource,
      mediaIds: [mediaId],
      x: 80,
      y: 80,
      width: 220,
      height: 120,
      action: 'fullscreen',
      clickCount: 1,
      triggerOnLoad: false,
      isActive: true,
      isNew: true,
    };
    setBoxes((prev) => [...prev, newBox]);
    setSelectedId(id);
  };

  const removeBox = async (box: EditorBox) => {
    if (box.isNew) {
      setBoxes((prev) => prev.filter((item) => item._id !== box._id));
      if (selectedId === box._id) setSelectedId(null);
      return;
    }

    try {
      const res = await fetch(`/api/admin/invisible-boxes/${box._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setBoxes((prev) => prev.filter((item) => item._id !== box._id));
      if (selectedId === box._id) setSelectedId(null);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete box');
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const box of boxes) {
        const payload = {
          name: box.name,
          pageType: box.pageType,
          playerSource: box.playerSource,
          mediaIds: box.mediaIds,
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.max(40, Math.round(box.width)),
          height: Math.max(40, Math.round(box.height)),
          action: box.action,
          customAction: box.action === 'custom' ? box.customAction : undefined,
          clickCount: Math.max(1, Math.round(box.clickCount || 1)),
          triggerOnLoad: Boolean(box.triggerOnLoad),
          isActive: box.isActive,
        };

        if (box.isNew) {
          const createRes = await fetch('/api/admin/invisible-boxes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!createRes.ok) throw new Error(`Create failed for ${box.name}`);
        } else {
          const updateRes = await fetch(`/api/admin/invisible-boxes/${box._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!updateRes.ok) throw new Error(`Update failed for ${box.name}`);
        }
      }

      await fetchBoxes();
    } catch (error) {
      console.error('Save all failed:', error);
      alert('Failed to save some boxes');
    } finally {
      setSaving(false);
    }
  };

  const handleButtonPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragState.pointerId = e.pointerId;
    dragState.startPointerX = e.clientX;
    dragState.startPointerY = e.clientY;
    dragState.startButtonX = buttonPos.x;
    dragState.startButtonY = buttonPos.y;
    dragState.moved = false;
    setDraggingButton(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleButtonPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingButton || e.pointerId !== dragState.pointerId) return;

    const dx = e.clientX - dragState.startPointerX;
    const dy = e.clientY - dragState.startPointerY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragState.moved = true;
    }

    const nextPos = clampButtonPos(dragState.startButtonX + dx, dragState.startButtonY + dy);
    setButtonPos(nextPos);
  };

  const handleButtonPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== dragState.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore pointer-capture release errors.
    }

    setDraggingButton(false);

    if (!dragState.moved) {
      setOpen((prev) => !prev);
    }
  };

  const floatingTools = (
    <>
      <button
        onPointerDown={handleButtonPointerDown}
        onPointerMove={handleButtonPointerMove}
        onPointerUp={handleButtonPointerUp}
        onPointerCancel={() => setDraggingButton(false)}
        className="fixed z-[2147483646] rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-red-700"
        style={{
          left: `${buttonPos.x}px`,
          top: `${buttonPos.y}px`,
          cursor: draggingButton ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        type="button"
      >
        {open ? 'Hide Box Tools' : 'Box Tools'}
      </button>

      {open && (
        <>
          <div className="absolute inset-0 z-[70] pointer-events-none">
            {boxes
              .filter((box) => box.action !== 'click')
              .map((box) => (
                <InvisibleBox
                  key={box._id}
                  id={box._id}
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  action={box.action}
                  customAction={box.customAction}
                  isDraggable={true}
                  isResizable={true}
                  showOutline={true}
                  containerRef={containerRef}
                  allowOutsideContainer={false}
                  onAction={() => setSelectedId(box._id)}
                  onPositionChange={(x, y) => updateBox(box._id, { x, y })}
                  onSizeChange={(width, height) => updateBox(box._id, { width, height })}
                />
              ))}
          </div>

          <div className="fixed inset-0 z-[69] pointer-events-none">
            {boxes
              .filter((box) => box.action === 'click')
              .map((box) => (
                <InvisibleBox
                  key={box._id}
                  id={box._id}
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  action={box.action}
                  customAction={box.customAction}
                  isDraggable={true}
                  isResizable={true}
                  showOutline={true}
                  allowOutsideContainer={true}
                  onAction={() => setSelectedId(box._id)}
                  onPositionChange={(x, y) => updateBox(box._id, { x, y })}
                  onSizeChange={(width, height) => updateBox(box._id, { width, height })}
                />
              ))}
          </div>
          <div
            className="fixed z-[2147483646] w-72 max-h-[75vh] overflow-auto rounded-lg border border-gray-700 bg-gray-900/95 p-3 text-white shadow-2xl"
            style={{
              left: `${buttonPos.x}px`,
              top: `${Math.max(8, buttonPos.y - 320)}px`,
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Inline Invisible Box Editor</p>
              <button
                onClick={() => setOpen(false)}
                className="rounded bg-gray-700 px-2 py-1 text-xs hover:bg-gray-600"
                type="button"
              >
                Close
              </button>
            </div>

            <p className="mb-3 text-xs text-gray-400">
              Source: {playerSource} | Type: {mediaType} | Media: {mediaId}
            </p>

            <div className="mb-3 flex gap-2">
              <button
                onClick={addBox}
                className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold hover:bg-green-700"
                type="button"
              >
                Add Box
              </button>
              <button
                onClick={saveAll}
                disabled={saving}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
                type="button"
              >
                {saving ? 'Saving...' : 'Save All'}
              </button>
            </div>

            {loading ? (
              <p className="text-xs text-gray-400">Loading...</p>
            ) : boxes.length === 0 ? (
              <p className="text-xs text-gray-400">No boxes yet.</p>
            ) : (
              <div className="space-y-2">
                {boxes.map((box) => (
                  <button
                    key={box._id}
                    onClick={() => setSelectedId(box._id)}
                    className={`w-full rounded border px-2 py-1 text-left text-xs transition ${
                      selectedId === box._id
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                    }`}
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{box.name}</span>
                      <span>{Math.max(1, Number(box.clickCount) || 1)}x</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedBox && (
              <div className="mt-3 space-y-2 border-t border-gray-700 pt-3">
                <input
                  value={selectedBox.name}
                  onChange={(e) => updateBox(selectedBox._id, { name: e.target.value })}
                  className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs"
                />

                <select
                  value={selectedBox.action}
                  onChange={(e) => updateBox(selectedBox._id, { action: e.target.value })}
                  className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs"
                >
                  {ACTIONS.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>

                {selectedBox.action === 'custom' && (
                  <textarea
                    value={selectedBox.customAction || ''}
                    onChange={(e) => updateBox(selectedBox._id, { customAction: e.target.value })}
                    className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs"
                    rows={2}
                    placeholder="Custom payload"
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={Math.round(selectedBox.x)}
                    onChange={(e) => updateBox(selectedBox._id, { x: Number(e.target.value) || 0 })}
                    className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs"
                    placeholder="x"
                  />
                  <input
                    type="number"
                    value={Math.round(selectedBox.y)}
                    onChange={(e) => updateBox(selectedBox._id, { y: Number(e.target.value) || 0 })}
                    className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs"
                    placeholder="y"
                  />
                  <input
                    type="number"
                    value={Math.round(selectedBox.width)}
                    onChange={(e) => updateBox(selectedBox._id, { width: Number(e.target.value) || 40 })}
                    className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs"
                    placeholder="width"
                  />
                  <input
                    type="number"
                    value={Math.round(selectedBox.height)}
                    onChange={(e) => updateBox(selectedBox._id, { height: Number(e.target.value) || 40 })}
                    className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs"
                    placeholder="height"
                  />
                </div>

                <input
                  type="number"
                  min={1}
                  value={Math.max(1, Number(selectedBox.clickCount) || 1)}
                  onChange={(e) => updateBox(selectedBox._id, { clickCount: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs"
                  placeholder="click count"
                />

                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedBox.triggerOnLoad)}
                    onChange={(e) => updateBox(selectedBox._id, { triggerOnLoad: e.target.checked })}
                  />
                  Trigger on player load
                </label>

                <button
                  onClick={() => removeBox(selectedBox)}
                  className="w-full rounded bg-red-700 px-3 py-1.5 text-xs font-semibold hover:bg-red-800"
                  type="button"
                >
                  Delete Selected
                </button>
              </div>
            )}
          </div>

          {triggeredBox && (
            <div
              className="fixed z-[2147483647] rounded-lg border border-blue-500 bg-blue-900/95 px-4 py-2 text-white shadow-2xl animate-pulse"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                maxWidth: '300px',
              }}
            >
              <p className="text-sm font-semibold">✓ Click Box Triggered</p>
              <p className="text-xs text-blue-200">Box: {triggeredBox.name}</p>
              <p className="text-xs text-blue-200">Source: {triggeredBox.triggerSource === 'load' ? 'On Load' : 'Manual Click'}</p>
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <>
      {fullscreenHost ? createPortal(floatingTools, fullscreenHost) : floatingTools}
    </>
  );
}
