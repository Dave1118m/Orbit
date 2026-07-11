import React from 'react';
import Modal from './Modal';

export default function InAppFileViewer({ attachment, isOpen, onClose }) {
  if (!attachment) return null;

  const downloadUrl = `https://localhost:7065/api/v1/tasks/attachments/${attachment.id}/download`;

  const renderContent = () => {
    if (attachment.mimeType.startsWith('image/')) {
      return (
        <div className="flex h-full items-center justify-center bg-slate-900">
          <img
            src={downloadUrl}
            alt={attachment.fileName}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      );
    }
    if (attachment.mimeType.startsWith('video/')) {
      return (
        <div className="flex h-full items-center justify-center bg-slate-900">
          <video
            src={downloadUrl}
            controls
            className="max-h-full max-w-full"
          />
        </div>
      );
    }
    if (attachment.mimeType === 'application/pdf') {
      return (
        <iframe
          src={downloadUrl}
          title={attachment.fileName}
          className="h-full w-full border-none"
        />
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 bg-slate-50 p-8">
        <div className="rounded-full bg-slate-200 p-6 text-slate-500">
          <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-center text-slate-600">
          In-app preview is not available for this file type.
        </p>
        <a
          href={downloadUrl}
          download={attachment.fileName}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-brand-500 px-6 py-2 font-semibold text-white transition hover:bg-brand-600"
        >
          Download {attachment.fileName}
        </a>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={attachment.fileName}>
      <div className="h-[70vh] w-full overflow-hidden rounded-xl">
        {renderContent()}
      </div>
    </Modal>
  );
}
