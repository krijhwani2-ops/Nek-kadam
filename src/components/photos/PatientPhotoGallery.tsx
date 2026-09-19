// ─── Nek Kadam: Patient Profile Clinical Photo Gallery ───
// Features: Apple-inspired responsive 3-column grid, count header,
// infinite "+ Add Photo", dual-capture ActionSheet (camera/gallery),
// lazy loading, optimistic UI, quota safety, and full-screen lightbox viewer.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Image, Plus, Lock, Maximize2, X, AlertCircle } from 'lucide-react';
import {
  PatientPhoto,
  getPatientPhotos,
  savePatientPhoto,
  deletePatientPhoto,
} from '../../lib/photos/photoStore';
import { PhotoViewerModal } from './PhotoViewerModal';

export interface PatientPhotoGalleryProps {
  cardNumber: string;
  patientName?: string;
}

export const PatientPhotoGallery: React.FC<PatientPhotoGalleryProps> = ({
  cardNumber,
  patientName,
}) => {
  const [photos, setPhotos] = useState<PatientPhoto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingCount, setProcessingCount] = useState<number>(0);

  // Modals state
  const [showActionSheet, setShowActionSheet] = useState<boolean>(false);
  const [viewerOpen, setViewerOpen] = useState<boolean>(false);
  const [viewerIndex, setViewerIndex] = useState<number>(0);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Hidden file inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((cur) => (cur?.message === message ? null : cur));
    }, 4000);
  }, []);

  // Load photos for this patient on mount or when cardNumber changes
  const loadPhotos = useCallback(async () => {
    if (!cardNumber) {
      setPhotos([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const items = await getPatientPhotos(cardNumber);
      setPhotos(items);
    } catch (err) {
      console.error('[PHOTO GALLERY] Failed to load photos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [cardNumber]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // File ingestion & optimization pipeline
  const processFiles = async (files: File[]) => {
    if (!files.length || !cardNumber) return;

    setIsProcessing(true);
    setProcessingCount(files.length);
    setShowActionSheet(false);

    let savedCount = 0;
    let lastError: any = null;

    for (const file of files) {
      try {
        const saved = await savePatientPhoto(cardNumber, file);
        setPhotos((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
        savedCount++;
      } catch (err: any) {
        console.error('[PHOTO GALLERY] Failed to save photo:', err);
        lastError = err;
      } finally {
        setProcessingCount((c) => Math.max(0, c - 1));
      }
    }

    setIsProcessing(false);

    if (savedCount > 0) {
      showToast(
        `${savedCount} ${savedCount === 1 ? 'photo' : 'photos'} attached to this device.`,
        'success'
      );
    }
    if (lastError) {
      showToast(lastError.message || 'Failed to save one or more photos.', 'error');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      const files = Array.from(fileList);
      processFiles(files);
    }
    // Reset to allow selecting the same file again
    e.target.value = '';
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      const ok = await deletePatientPhoto(photoId, cardNumber);
      if (ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        showToast('Photo removed from this device.', 'success');
      } else {
        showToast('Failed to delete photo from storage.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting photo.', 'error');
    }
  };

  const openViewerAt = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return '';
    }
  };

  return (
    <section
      className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-5 shadow-xs border border-emerald-100/70 dark:border-slate-800 relative overflow-hidden"
      data-purpose="patient-photo-gallery"
    >
      {/* Hidden File Inputs for Dual Capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Slide-down Gallery Toast */}
      {toast && (
        <div
          className={`mb-3 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm transition-all ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
          }`}
          role="status"
        >
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <AlertCircle size={15} /> : <Lock size={15} />}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 1. Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Image size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base tracking-tight">
                Clinical Photos
              </h3>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 uppercase">
                {photos.length} {photos.length === 1 ? 'Photo' : 'Photos'}
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 mt-0.5">
              <Lock size={10} className="shrink-0" />
              <span>Local Device Storage • Zero Sync</span>
            </p>
          </div>
        </div>

        {/* Action button */}
        <button
          type="button"
          onClick={() => setShowActionSheet(true)}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all min-h-[38px]"
        >
          <Plus size={14} />
          <span>Add Photo</span>
        </button>
      </div>

      {/* 2. Responsive 3-Column Grid */}
      <div className="pt-3.5">
        <div className="grid grid-cols-3 gap-2 sm:gap-3" data-purpose="photo-grid">
          {/* Tile 1: Infinite + Add Photo Tile */}
          <button
            type="button"
            onClick={() => setShowActionSheet(true)}
            aria-label="Add new clinical photo"
            className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-95 group focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:border-emerald-500 transition-transform">
              <Plus size={18} className="text-slate-500 dark:text-slate-400 group-hover:text-emerald-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider">Add Photo</span>
          </button>

          {/* Optimistic Upload Shimmer Tiles */}
          {isProcessing &&
            Array.from({ length: processingCount }).map((_, idx) => (
              <div
                key={`optimistic-${idx}`}
                className="aspect-square rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-emerald-400/80 flex flex-col items-center justify-center animate-pulse p-1 text-center"
              >
                <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-1" />
                <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase">
                  Saving...
                </span>
              </div>
            ))}

          {/* Existing Photos */}
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              onClick={() => openViewerAt(index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openViewerAt(index);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View photo ${index + 1} taken on ${formatDate(photo.createdAt)}`}
              className="aspect-square rounded-xl overflow-hidden relative bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-800 group cursor-pointer active:scale-95 transition-all shadow-2xs hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {/* Thumbnail Image */}
              <img
                src={photo.thumbnailDataUrl || photo.localUri || ''}
                alt={photo.fileName}
                loading="lazy"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300 select-none"
              />

              {/* Apple Scrim & Hover Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                <div className="flex justify-end">
                  <span className="p-1 rounded-md bg-black/40 text-white backdrop-blur-xs">
                    <Maximize2 size={12} />
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-[9px] font-extrabold text-white tracking-tight drop-shadow-xs">
                    {formatDate(photo.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Empty State Placeholders when 0 photos and not loading */}
          {!isLoading && photos.length === 0 && !isProcessing && (
            <>
              <div className="aspect-square rounded-xl border border-dashed border-slate-200 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
                <Camera size={20} className="stroke-1 mb-1" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Camera</span>
              </div>
              <div className="aspect-square rounded-xl border border-dashed border-slate-200 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/20 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
                <Image size={20} className="stroke-1 mb-1" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Gallery</span>
              </div>
            </>
          )}
        </div>

        {/* Empty State Subtitle */}
        {!isLoading && photos.length === 0 && !isProcessing && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-3">
            No clinical photos attached yet. Tap <strong>+ Add Photo</strong> to capture or select images.
          </p>
        )}
      </div>

      {/* 3. Dual Capture Action Sheet / Popover */}
      {showActionSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowActionSheet(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="action-sheet-title"
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-2xl space-y-3 border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 id="action-sheet-title" className="font-black text-slate-800 dark:text-slate-100 text-sm">
                  Attach Clinical Photo
                </h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                  <Lock size={10} />
                  <span>Stored strictly on this device only</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowActionSheet(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            {/* Options */}
            <div className="space-y-2 pt-1">
              {/* Option 1: Take Photo */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 active:scale-98 transition-all text-left group min-h-[50px]"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Camera size={20} />
                </div>
                <div>
                  <p className="font-extrabold text-xs text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                    Take Photo
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Capture directly using device camera
                  </p>
                </div>
              </button>

              {/* Option 2: Choose from Gallery */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="w-full flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 active:scale-98 transition-all text-left group min-h-[50px]"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Image size={20} />
                </div>
                <div>
                  <p className="font-extrabold text-xs text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    Choose from Gallery
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Select single or multiple photos from storage
                  </p>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowActionSheet(false)}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Full-Screen Photo Lightbox Viewer */}
      <PhotoViewerModal
        isOpen={viewerOpen}
        photos={photos}
        initialIndex={viewerIndex}
        patientName={patientName}
        cardNumber={cardNumber}
        onClose={() => setViewerOpen(false)}
        onDeletePhoto={handleDeletePhoto}
      />
    </section>
  );
};

export default PatientPhotoGallery;
