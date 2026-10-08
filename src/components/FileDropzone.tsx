'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/i18n/LanguageContext';
import { notify } from '@/lib/notify';

/** True when the drag carries files (not text or a link dragged inside the page). */
const hasFiles = (e: DragEvent | React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/**
 * Checks a dropped/selected file and returns it, or null after showing why it was refused.
 * `extensions` are lowercase with the dot, e.g. ['.csv']; pass a stable (memoised or module-level) array.
 */
export function useFileValidator(extensions: string[], maxMB: number) {
  const t = useT();
  return useCallback(
    (files: FileList | File[] | null | undefined): File | null => {
      const list = Array.from(files ?? []);
      if (list.length === 0) return null;
      if (list.length > 1) notify.info(t('Hanya satu file yang dibaca. File pertama dipakai: {name}', { name: list[0].name }));
      const file = list[0];
      if (!extensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
        notify.warning(t('Format file tidak didukung. Gunakan file {types}.', { types: extensions.join(', ') }));
        return null;
      }
      if (file.size === 0) {
        notify.warning(t('File kosong: {name}', { name: file.name }));
        return null;
      }
      if (file.size > maxMB * 1024 * 1024) {
        notify.warning(t('File terlalu besar (maksimal {mb} MB): {name}', { mb: maxMB, name: file.name }));
        return null;
      }
      return file;
    },
    [t, maxMB, extensions]
  );
}

/**
 * A drop target that also opens the file picker on click or Enter/Space.
 * It only passes the first valid file to `onFile`; reading it is up to the caller.
 */
export default function FileDropzone({
  onFile,
  extensions,
  maxMB = 5,
  title,
  hint,
  icon = 'upload_file',
  inputId,
}: {
  onFile: (file: File) => void;
  extensions: string[];
  maxMB?: number;
  title: string;
  hint?: string;
  icon?: string;
  inputId?: string;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const validate = useFileValidator(extensions, maxMB);

  const take = (files: FileList | null) => {
    const file = validate(files);
    if (file) onFile(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={() => inputRef.current?.click()}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={e => { if (hasFiles(e)) { e.preventDefault(); setOver(true); } }}
      onDragOver={e => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOver(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
      onDrop={e => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={`group flex min-h-[10.5rem] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-600/25 ${
        over ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-card hover:border-blue-500'
      }`}
    >
      <span className={`material-symbols-outlined mb-2 text-4xl transition-colors ${over ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'}`} aria-hidden="true">
        {over ? 'download' : icon}
      </span>
      <p className="text-sm font-semibold text-slate-700">{over ? t('Lepaskan file di sini') : title}</p>
      {/* kept in the layout (just hidden) so the card does not change size while a file hovers over it */}
      {hint && <p className={`mt-1 text-xs text-slate-500 ${over ? 'invisible' : ''}`}>{hint}</p>}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="hidden"
        accept={extensions.join(',')}
        onChange={e => {
          take(e.target.files);
          e.target.value = ''; // picking the same file again must fire onChange again
        }}
      />
    </div>
  );
}

/**
 * Lets the user drop a file anywhere on the page. While a file is dragged over the window `dragging` is true
 * (show an overlay). A drop is passed to `onFile` only when `enabled`; otherwise it is ignored and `onBlocked`
 * runs, so the browser never navigates away to the dropped file.
 */
export function useWindowFileDrop({
  onFile,
  enabled,
  onBlocked,
  extensions,
  maxMB = 5,
}: {
  onFile: (file: File) => void;
  enabled: boolean;
  onBlocked?: () => void;
  extensions: string[];
  maxMB?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const validate = useFileValidator(extensions, maxMB);
  const latest = useRef({ onFile, enabled, onBlocked, validate });
  // keep the listeners below pointing at the newest props without re-registering them on every render
  useEffect(() => {
    latest.current = { onFile, enabled, onBlocked, validate };
  });

  useEffect(() => {
    // While a file is dragged, `dragover` fires continuously (about every 50-350 ms). If it stops for a while the drag
    // is over (dropped elsewhere, cancelled with Esc, left the window) even when no drop/leave event reached us,
    // so a watchdog hides the overlay instead of trusting the event order.
    let lastSeen = 0;
    let watchdog: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (watchdog) clearInterval(watchdog);
      watchdog = null;
      setDragging(false);
    };
    const touch = () => {
      lastSeen = Date.now();
      setDragging(true);
      if (!watchdog) watchdog = setInterval(() => { if (Date.now() - lastSeen > 1200) stop(); }, 300);
    };
    const enter = (e: DragEvent) => {
      if (hasFiles(e) && latest.current.enabled) touch();
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = latest.current.enabled ? 'copy' : 'none';
      if (latest.current.enabled) touch();
    };
    const leave = (e: DragEvent) => {
      // the pointer left the browser window (dragleave also fires between elements, so only the window edge counts;
      // relatedTarget is not reliable across browsers)
      if (hasFiles(e) && (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)) stop();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      stop();
      const { enabled: on, onFile: handle, onBlocked: blocked, validate: check } = latest.current;
      if (!on) { blocked?.(); return; }
      const file = check(e.dataTransfer?.files);
      if (file) handle(file);
    };
    // Capture phase runs before any element's handler (a drop target may stopPropagation), so a drop always clears it
    window.addEventListener('drop', stop, true);
    window.addEventListener('dragend', stop, true);
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      if (watchdog) clearInterval(watchdog);
      window.removeEventListener('drop', stop, true);
      window.removeEventListener('dragend', stop, true);
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  // never show it while the page does not accept drops (e.g. a review dialog is open)
  return dragging && enabled;
}

/** Full-page hint shown while a file is dragged over the window. */
export function DropOverlay({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-[2px] print:hidden" role="status" aria-live="polite">
      <div className="flex max-w-md flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-blue-600 bg-card px-10 py-12 text-center shadow-xl">
        <span className="material-symbols-outlined text-5xl text-blue-600" aria-hidden="true">upload_file</span>
        <p className="text-base font-semibold text-slate-900">{title}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
