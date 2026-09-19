// ─── Nek Kadam: Full-Screen Clinical Photo Viewer Lightbox ───
// Features: "Photo X of Y", touch swipe, desktop chevron arrows, keyboard navigation,
// double-tap and pinch-to-zoom (1x-4x), and isolated safe delete confirmation.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Trash2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { PatientPhoto, getPatientPhotoUrl } from '../../lib/photos/photoStore';

export interface PhotoViewerModalProps {
  isOpen: boolean;
  photos: PatientPhoto[];
  initialIndex?: number;
  patientName?: string;
  cardNumber?: string;
  onClose: () => void;
  onDeletePhoto?: (photoId: string) => Promise<void> | void;
}

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
  isOpen,
  photos,
  initialIndex = 0,
  patientName,
  cardNumber,
  onClose,
  onDeletePhoto,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Gesture refs
  const touchStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const touchDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartDistRef = useRef<number>(0);
  const pinchStartScaleRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);
  const activeBlobUrlRef = useRef<string | null>(null);

  // Sync index on initial open or when photos change
  useEffect(() => {
    if (isOpen) {
      const validIndex = Math.min(Math.max(0, initialIndex), Math.max(0, photos.length - 1));
      setCurrentIndex(validIndex);
      setScale(1);
      setPan({ x: 0, y: 0 });
      setShowDeleteConfirm(false);
    }
  }, [isOpen, initialIndex, photos.length]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  const currentPhoto = photos[currentIndex];

  // Resolve and load photo URL
  useEffect(() => {
    let isCancelled = false;

    if (!isOpen || !currentPhoto) {
      setCurrentUrl('');
      return;
    }

    // Set thumbnail immediately while loading full image
    if (currentPhoto.thumbnailDataUrl) {
      setCurrentUrl(currentPhoto.thumbnailDataUrl);
    }

    getPatientPhotoUrl(currentPhoto)
      .then((url) => {
        if (!isCancelled && url) {
          if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:')) {
            URL.revokeObjectURL(activeBlobUrlRef.current);
          }
          activeBlobUrlRef.current = url;
          setCurrentUrl(url);
        }
      })
      .catch((err) => {
        console.warn('[PHOTO VIEWER] Failed to load full photo URL:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, currentPhoto]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, []);

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setScale(1);
      setPan({ x: 0, y: 0 });
    }
  }, [currentIndex, photos.length]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setScale(1);
      setPan({ x: 0, y: 0 });
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showDeleteConfirm) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowDeleteConfirm(false);
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showDeleteConfirm, goToNext, goToPrev, onClose]);

  // Touch gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;
      lastTapRef.current = now;

      // Double-tap zoom detection (< 300ms)
      if (timeSinceLastTap < 300) {
        if (scale > 1) {
          setScale(1);
          setPan({ x: 0, y: 0 });
        } else {
          setScale(2.5);
          setPan({ x: 0, y: 0 });
        }
        return;
      }

      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: now,
      };
      touchDeltaRef.current = { x: 0, y: 0 };
      setIsDragging(true);
    } else if (e.touches.length === 2) {
      // Pinch zoom start
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = scale;
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    if (e.touches.length === 2 && pinchStartDistRef.current > 0) {
      // Pinch to zoom
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / pinchStartDistRef.current;
      const targetScale = Math.min(Math.max(1, pinchStartScaleRef.current * ratio), 4);
      setScale(targetScale);
      if (targetScale <= 1.05) {
        setPan({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - touchStartRef.current.x;
      const deltaY = e.touches[0].clientY - touchStartRef.current.y;
      touchDeltaRef.current = { x: deltaX, y: deltaY };

      if (scale > 1) {
        // Panning when zoomed
        const maxPanX = (window.innerWidth * (scale - 1)) / 2;
        const maxPanY = (window.innerHeight * (scale - 1)) / 2;
        setPan({
          x: Math.min(Math.max(pan.x + deltaX * 0.1, -maxPanX), maxPanX),
          y: Math.min(Math.max(pan.y + deltaY * 0.1, -maxPanY), maxPanY),
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);
    pinchStartDistRef.current = 0;

    if (scale <= 1) {
      const deltaX = touchDeltaRef.current.x;
      const duration = Date.now() - touchStartRef.current.time;
      const velocity = Math.abs(deltaX) / Math.max(1, duration);

      // Horizontal swipe threshold: > 50px or quick flick velocity > 0.3
      if (Math.abs(deltaX) > 50 || velocity > 0.3) {
        if (deltaX < 0) {
          goToNext();
        } else {
          goToPrev();
        }
      }
      touchDeltaRef.current = { x: 0, y: 0 };
    }
  };

  const handleDeleteCurrent = async () => {
    if (!currentPhoto || !onDeletePhoto) return;
    try {
      setIsDeleting(true);
      await onDeletePhoto(currentPhoto.id);
      setShowDeleteConfirm(false);

      if (photos.length <= 1) {
        onClose();
      } else if (currentIndex >= photos.length - 1) {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('[PHOTO VIEWER] Failed to delete photo:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || photos.length === 0 || !currentPhoto) {
    return null;
  }

  const formattedDate = currentPhoto.createdAt
    ? new Date(currentPhoto.createdAt).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col select-none touch-none"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      {/* 1. Header Bar */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        {/* Left: Apple-style Counter Badge */}
        <div className="flex items-center gap-2">
          <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-white/90 border border-white/15">
            Photo {currentIndex + 1} of {photos.length}
          </span>
        </div>

        {/* Center: Metadata context */}
        <div className="text-center truncate px-2 hidden sm:block">
          <p className="text-xs font-bold text-white/90 truncate">
            {patientName ? `${patientName} • ` : ''}
            {cardNumber ? `Card #${cardNumber}` : ''}
          </p>
          {formattedDate && (
            <p className="text-[10px] text-white/60 truncate">{formattedDate}</p>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {onDeletePhoto && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Delete photo"
              className="p-2.5 rounded-full text-red-400 hover:text-red-300 hover:bg-red-500/20 active:scale-95 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Trash2 size={18} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close viewer"
            className="p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* 2. Main Viewport & Interactive Image Canvas */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden p-2 sm:p-6"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={currentPhoto.fileName || 'Clinical photo attachment'}
            className="max-h-full max-w-full object-contain pointer-events-none select-none rounded-sm shadow-2xl"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            draggable={false}
          />
        ) : (
          <div className="flex items-center justify-center text-white/50 text-sm">
            Loading photo...
          </div>
        )}

        {/* Desktop Previous Button */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={goToPrev}
            aria-label="Previous photo"
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white/90 items-center justify-center backdrop-blur-sm transition-all active:scale-90"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {/* Desktop Next Button */}
        {currentIndex < photos.length - 1 && (
          <button
            type="button"
            onClick={goToNext}
            aria-label="Next photo"
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white/90 items-center justify-center backdrop-blur-sm transition-all active:scale-90"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      {/* 3. Footer Bar: Mobile info caption */}
      <footer className="relative z-10 px-4 py-2.5 text-center sm:hidden bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-[11px] font-bold text-white/80 truncate">
          {patientName ? `${patientName} • ` : ''}
          {cardNumber ? `Card #${cardNumber}` : ''}
        </p>
        {formattedDate && (
          <p className="text-[10px] text-white/50">{formattedDate}</p>
        )}
      </footer>

      {/* 4. Safe Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          role="alertdialog"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-desc"
        >
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 id="delete-dialog-title" className="font-bold text-slate-100 text-sm">
                  Delete Photo Attachment?
                </h4>
                <p className="text-[11px] text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p id="delete-dialog-desc" className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete this photo from this device? This will permanently remove the image file. <strong className="text-white">Patient records, medical history, and prescriptions will NOT be affected.</strong>
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCurrent}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 transition-all flex items-center gap-1.5 min-h-[44px]"
              >
                {isDeleting ? 'Deleting...' : 'Delete Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoViewerModal;
