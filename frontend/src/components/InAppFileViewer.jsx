import React, { useEffect, useState } from 'react';
import Modal from './Modal';

export default function InAppFileViewer({ attachment, isOpen, onClose, entityType }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [hasPreviewError, setHasPreviewError] = useState(false);

  const resource = entityType || (attachment?.entityType ? String(attachment.entityType).toLowerCase() : 'tasks');
  const downloadUrl = attachment ? `${import.meta.env.VITE_API_URL}/${resource}/attachments/${attachment.id}/download` : '';

  useEffect(() => {
    if (!attachment || !isOpen) {
      setPreviewUrl('');
      setHasPreviewError(false);
      return;
    }

    let isMounted = true;
    const token = localStorage.getItem('token');

    const fetchPreview = async () => {
      try {
        console.log('Fetching preview from:', downloadUrl);
        const response = await fetch(downloadUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        console.log('Preview response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to fetch preview:', response.status, errorText);
          setHasPreviewError(true);
          return;
        }

        const blob = await response.blob();
        console.log('Blob size:', blob.size, 'type:', blob.type);
        const blobUrl = URL.createObjectURL(blob);
        console.log('Created blob URL:', blobUrl);
        
        if (isMounted) {
          setPreviewUrl(blobUrl);
          setHasPreviewError(false);
        }
      } catch (err) {
        console.error('Failed to load attachment preview', err);
        setHasPreviewError(true);
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [attachment?.id, downloadUrl, isOpen]);

  if (!attachment || !isOpen) return null;

  const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const handleDownload = async () => {
    try {
      const response = await fetch(downloadUrl, { headers: getAuthHeaders() });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download attachment', err);
    }
  };

  const handleOpen = async () => {
    try {
      if (previewUrl) {
        window.open(previewUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      const response = await fetch(downloadUrl, { headers: getAuthHeaders() });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
      console.error('Failed to open attachment', err);
    }
  };

  const renderContent = () => {
    if (hasPreviewError) {
      return (
        <div className="flex h-full flex-col items-center justify-center space-y-4 bg-slate-50 p-8">
          <div className="rounded-full bg-red-100 p-6 text-red-500">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-center text-slate-600">
            Failed to load preview. The file might not be accessible.
          </p>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-full bg-brand-500 px-6 py-2 font-semibold text-white transition hover:bg-brand-600"
          >
            Download {attachment.fileName}
          </button>
        </div>
      );
    }

    if (!previewUrl) {
      return (
        <div className="flex h-full items-center justify-center bg-slate-50">
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5 text-brand-600" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span className="text-sm text-slate-600">Loading preview...</span>
          </div>
        </div>
      );
    }

    const mimeType = attachment.mimeType || '';
    const fileName = attachment.fileName || '';
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (mimeType.startsWith('image/')) {
      return (
        <div className="flex h-full items-center justify-center bg-slate-900">
          <img
            src={previewUrl}
            alt={attachment.fileName}
            className="max-h-full max-w-full object-contain"
            onError={() => setHasPreviewError(true)}
          />
        </div>
      );
    }
    if (mimeType.startsWith('video/')) {
      return (
        <div className="flex h-full items-center justify-center bg-slate-900">
          <video
            src={previewUrl}
            controls
            className="max-h-full max-w-full"
            onError={() => setHasPreviewError(true)}
          />
        </div>
      );
    }
    if (mimeType === 'application/pdf') {
      return (
        <iframe
          src={previewUrl}
          title={attachment.fileName}
          className="h-full w-full border-none"
          onError={() => setHasPreviewError(true)}
        />
      );
    }

    // Office Document Previews (.docx, .xlsx, .pptx)
    if (
      ext === 'docx' ||
      ext === 'doc' ||
      ext === 'xlsx' ||
      ext === 'xls' ||
      ext === 'pptx' ||
      mimeType.includes('wordprocessingml') ||
      mimeType.includes('spreadsheetml') ||
      mimeType.includes('presentationml')
    ) {
      return (
        <div className="flex h-full flex-col items-center justify-center space-y-4 bg-slate-900/90 p-8 text-white">
          <div className="rounded-2xl bg-indigo-500/20 p-6 ring-1 ring-indigo-400/30">
            <svg className="h-14 w-14 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-center space-y-1">
            <h4 className="font-semibold text-lg text-slate-100">{attachment.fileName}</h4>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Office Document In-App Viewer</p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleOpen}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 transition"
            >
              Interactive In-Tab Preview
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-xl bg-slate-800 border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              Download File
            </button>
          </div>
        </div>
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
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-full bg-brand-500 px-6 py-2 font-semibold text-white transition hover:bg-brand-600"
        >
          Download {attachment.fileName}
        </button>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={attachment.fileName}>
      <div className="h-[70vh] w-full overflow-hidden rounded-xl flex flex-col">
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-white p-4">
          <button
            type="button"
            onClick={handleOpen}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Download
          </button>
        </div>
      </div>
    </Modal>
  );
}
