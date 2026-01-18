'use client';

import { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';

interface ProfileImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageUrl: string) => Promise<void>;
  currentImage?: string;
  userName?: string;
}

export default function ProfileImageEditor({
  isOpen,
  onClose,
  onSave,
  currentImage,
  userName = 'User',
}: ProfileImageEditorProps) {
  const { update: updateSession } = useSession();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(currentImage || '');
  const [scale, setScale] = useState(100);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !previewUrl) return;

    setIsSaving(true);
    try {
      // Draw the cropped image on canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Calculate the size of the image at the current scale
        const scaledWidth = img.width * (scale / 100);
        const scaledHeight = img.height * (scale / 100);
        
        // Calculate position with offsets (for panning)
        // Note: CSS translate moves the element, canvas position moves the drawing point
        // So we need opposite signs: translate(+offsetX) shows left part, so canvas draws at -offsetX
        const x = (canvas.width - scaledWidth) / 2 - offsetX;
        const y = (canvas.height - scaledHeight) / 2 - offsetY;
        
        // Draw the scaled image at the calculated position
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

        // Convert canvas to blob and upload
        canvas.toBlob(async (blob) => {
          if (!blob) {
            console.error('Failed to convert canvas to blob');
            alert('Error processing image');
            setIsSaving(false);
            return;
          }

          console.log('Canvas blob size:', blob.size, 'bytes');

          const formData = new FormData();
          formData.append('file', blob, 'profile.jpg');

          try {
            console.log('Uploading profile image...');
            const response = await fetch('/api/user/upload-profile-image', {
              method: 'POST',
              body: formData,
            });

            console.log('Upload response status:', response.status);
            const data = await response.json();
            console.log('Upload response:', data);

            if (response.ok) {
              console.log('Image uploaded successfully, updating session...');
              await onSave(data.imageUrl);
              // Refresh the session to update the image from server
              await updateSession();
              onClose();
            } else {
              console.error('Upload failed:', data.error);
              alert('Failed to upload image: ' + (data.error || 'Unknown error'));
            }
          } catch (error) {
            console.error('Upload error:', error);
            alert('Error uploading image: ' + String(error));
          } finally {
            setIsSaving(false);
          }
        }, 'image/jpeg', 0.6);
      };
      img.onerror = () => {
        console.error('Failed to load preview image');
        alert('Error loading image');
        setIsSaving(false);
      };
      img.src = previewUrl;
    } catch (error) {
      console.error('Error saving image:', error);
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#1a1a2e]/95 to-[#16213e]/95 p-4 sm:p-6 shadow-2xl border border-[#E50914]/30 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Change Profile</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-400 hover:text-white disabled:opacity-50 flex-shrink-0"
          >
            <X size={24} />
          </button>
        </div>

        {/* Image Preview Section */}
        <div className="mb-6">
          <div className="mb-4 flex justify-center">
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 bg-[#0f172a] rounded-full border-4 border-[#E50914]/50 overflow-hidden flex-shrink-0">
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                  style={{
                    transform: `scale(${scale / 100}) translate(${offsetX}px, ${offsetY}px)`,
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-700 text-gray-400">
                  <Upload size={32} />
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          {previewUrl && (
            <div className="space-y-3">
              {/* Scale Slider */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Zoom ({scale}%)
                </label>
                <input
                  type="range"
                  min="50"
                  max="300"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#E50914]"
                />
              </div>

              {/* Position Controls */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Left/Right
                  </label>
                  <input
                    type="range"
                    min="-200"
                    max="200"
                    value={offsetX}
                    onChange={(e) => setOffsetX(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#E50914]"
                  />
                  <span className="text-xs text-gray-400">{offsetX}px</span>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Up/Down
                  </label>
                  <input
                    type="range"
                    min="-200"
                    max="200"
                    value={offsetY}
                    onChange={(e) => setOffsetY(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#E50914]"
                  />
                  <span className="text-xs text-gray-400">{offsetY}px</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Buttons */}
        <div className="space-y-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSaving}
            className="w-full rounded-lg bg-blue-600 p-2 sm:p-3 text-sm sm:text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {previewUrl ? 'Choose Different Image' : 'Select Image'}
          </button>
          {previewUrl && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full rounded-lg bg-[#E50914] p-2 sm:p-3 text-sm sm:text-base font-semibold text-white hover:bg-[#CC0812] disabled:opacity-50 transition"
            >
              {isSaving ? 'Saving...' : 'Save Profile Picture'}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isSaving}
            className="w-full rounded-lg bg-gray-700 p-2 sm:p-3 text-sm sm:text-base font-semibold text-white hover:bg-gray-600 disabled:opacity-50 transition"
          >
            Cancel
          </button>
        </div>

        {/* Hidden canvas for image processing */}
        <canvas ref={canvasRef} width={256} height={256} className="hidden" />
      </div>
    </div>
  );
}
