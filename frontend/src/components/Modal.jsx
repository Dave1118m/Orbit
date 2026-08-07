import { useEffect, useRef } from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClick = (e) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onClose={onClose}
      className="backdrop:bg-slate-900/60 backdrop:backdrop-blur-xs p-0 rounded-2xl shadow-2xl m-auto w-[min(92vw,480px)] max-w-md border border-slate-100 bg-white overflow-hidden transition-all duration-200"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
        <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
        <button
          onClick={onClose}
          type="button"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-5">
        {children}
      </div>
    </dialog>
  );
}
