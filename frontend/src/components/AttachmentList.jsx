import React, { useState, useEffect, useRef, useCallback } from 'react';
import InAppFileViewer from './InAppFileViewer';
import { parseApiResponse } from '../utils/toastHelper';

export default function AttachmentList({ entityType, entityId }) {
  const [attachments, setAttachments] = useState([]);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const API_URL = `${import.meta.env.VITE_API_URL}/${entityType}/${entityId}/attachments`;

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchAttachments = useCallback(async () => {
    console.log('Fetching attachments from:', API_URL);
    console.log('Entity type:', entityType, 'Entity ID:', entityId);
    try {
      const res = await fetch(API_URL, {
        headers: getAuthHeaders()
      });
      console.log('Fetch response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('Fetched attachments:', data);
        console.log('Attachments data type:', typeof data, 'Is array:', Array.isArray(data));
        // Always update with fresh data from database
        if (Array.isArray(data)) {
          setAttachments(data);
          console.log('Updated attachments state with', data.length, 'items');
        } else {
          console.error('Invalid attachment data format:', data);
          setAttachments([]);
        }
      } else {
        const errorText = await parseApiResponse(res);
        console.error('Failed to fetch attachments:', res.status, errorText);
        setAttachments([]);
      }
    } catch (err) { 
      console.error('Error fetching attachments:', err); 
      setAttachments([]);
    }
  }, [API_URL, getAuthHeaders, entityType, entityId]);

  const getDownloadUrl = useCallback((attachment) => `${import.meta.env.VITE_API_URL}/${entityType}/attachments/${attachment.id}/download`, [entityType]);

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // Fetch attachments on mount and when entityId/entityType changes
  useEffect(() => {
    if (entityId) {
      fetchAttachments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, entityType]);

  const openAttachment = async (attachment) => {
    // Open directly in new tab using the download URL (serves with inline disposition)
    const newWindow = window.open(getDownloadUrl(attachment), '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      // Fallback: try blob approach if popup blocked
      try {
        const res = await fetch(getDownloadUrl(attachment), {
          headers: getAuthHeaders()
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const fallbackWindow = window.open(url, '_blank');
        if (fallbackWindow) {
          setTimeout(() => URL.revokeObjectURL(url), 15000);
        }
      } catch (err) {
        console.error('Failed to open attachment', err);
      }
    }
  };

  const downloadAttachment = async (attachment) => {
    try {
      const res = await fetch(getDownloadUrl(attachment), {
        headers: getAuthHeaders()
      });
      if (!res.ok) return;
      const blob = await res.blob();
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

  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError('');

    let hasError = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });

        if (!res.ok) {
          const text = await parseApiResponse(res);
          console.error('Upload failed', res.status, text);
          hasError = true;
          setUploadError(prev => prev ? prev + ' | ' + (text || `Status ${res.status}`) : (text || `Status ${res.status}`));
          continue;
        }

        const uploaded = await res.json();
        console.log('Uploaded attachment:', uploaded);
        
        // Add uploaded attachment to state immediately
        setAttachments(prev => {
          const exists = prev.some(item => item.id === uploaded.id);
          return exists ? prev : [uploaded, ...prev];
        });
      } catch (err) {
        console.error('Upload error', err);
        hasError = true;
        setUploadError(err?.message || 'Upload error');
      }
    }

    if (!hasError) {
      setUploadError('');
    }

    if (fileInputRef.current) fileInputRef.current.value = null;
    setUploading(false);
  };

  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudProvider, setCloudProvider] = useState('Google Drive');
  const [cloudUrlInput, setCloudUrlInput] = useState('');
  const [cloudFileNameInput, setCloudFileNameInput] = useState('');

  const handleCloudAttach = async (e) => {
    e.preventDefault();
    if (!cloudUrlInput.trim()) return;

    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('cloudUrl', cloudUrlInput.trim());
      formData.append('cloudProvider', cloudProvider);
      formData.append('cloudFileName', cloudFileNameInput.trim());

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!res.ok) {
        const text = await parseApiResponse(res);
        setUploadError(text || 'Cloud import failed');
        setUploading(false);
        return;
      }

      const uploaded = await res.json();
      setAttachments(prev => [uploaded, ...prev]);
      setShowCloudModal(false);
      setCloudUrlInput('');
      setCloudFileNameInput('');
    } catch (err) {
      console.error('Cloud attachment error', err);
      setUploadError(err?.message || 'Failed to attach cloud file');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    await uploadFiles(files);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer?.files || []);
    await uploadFiles(files);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div
        className={`relative flex shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 transition ${uploading ? 'opacity-70 pointer-events-none' : 'hover:bg-slate-100 cursor-pointer'} ${dragActive ? 'border-brand-500 bg-brand-50' : ''}`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDrop={handleDrop}
      >
        {uploading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-brand-600" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
              <span className="text-sm font-medium text-brand-600">Uploading...</span>
            </div>
          </div>
        )}
        <div className="rounded-full bg-brand-100 p-2 text-brand-600 mb-2 shadow-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
        <p className="text-xs font-medium text-slate-600">Click to upload or drag and drop files</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => { setCloudProvider('Google Drive'); setShowCloudModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <span className="font-bold text-blue-600">G</span> Drive Import
          </button>
          <button
            type="button"
            onClick={() => { setCloudProvider('OneDrive'); setShowCloudModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <span className="font-bold text-sky-600">☁</span> OneDrive Import
          </button>
        </div>

        <input
          type="file"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
      </div>

      {uploadError && (
        <div className="text-xs text-red-600">{uploadError}</div>
      )}

      <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1">
        {attachments.map((att) => (
          <div
            key={att.id}
            className="group flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-300 hover:shadow transition"
          >
            <button
              type="button"
              onClick={() => openAttachment(att)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600 transition"
              title="Open attachment"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{att.fileName}</p>
              <p className="text-[11px] text-slate-500">{(att.fileSizeBytes / 1024).toFixed(1)} KB</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedAttachment(att)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => downloadAttachment(att)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
              >
                Download
              </button>
            </div>
          </div>
        ))}
        {attachments.length === 0 && (
          <p className="text-center text-xs text-slate-500">No attachments yet.</p>
        )}
      </div>

      {/* Real Cloud Storage Importer Modal */}
      {showCloudModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`text-lg font-black ${cloudProvider === 'Google Drive' ? 'text-blue-600' : 'text-sky-600'}`}>
                  {cloudProvider === 'Google Drive' ? 'G' : '☁'}
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Import from {cloudProvider}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCloudModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCloudAttach} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Document / File Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder={`e.g., Donor Grant Agreement (${cloudProvider})`}
                  value={cloudFileNameInput}
                  onChange={(e) => setCloudFileNameInput(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {cloudProvider} Shared Link / URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder={cloudProvider === 'Google Drive' ? 'https://drive.google.com/file/d/...' : 'https://1drv.ms/b/s!...'}
                  value={cloudUrlInput}
                  onChange={(e) => setCloudUrlInput(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCloudModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs ${
                    cloudProvider === 'Google Drive' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {uploading ? 'Attaching...' : 'Attach Cloud Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <InAppFileViewer
        attachment={selectedAttachment}
        isOpen={!!selectedAttachment}
        onClose={() => setSelectedAttachment(null)}
        entityType={entityType}
      />
    </div>
  );
}
