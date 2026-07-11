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
      className="backdrop:bg-slate-950/70 p-0 rounded-2xl shadow-2xl open:animate-in open:fade-in open:zoom-in-95 m-auto w-full max-w-lg border border-slate-200 bg-white"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <button
          onClick={onClose}
          type="button"
          className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-6">
        {children}
      </div>
    </dialog>
  );
}
