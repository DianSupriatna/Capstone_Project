import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'confirm', // 'confirm' | 'danger' | 'alert'
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  loading = false
}) {
  if (!isOpen) return null;

  const isDanger = type === 'danger';
  const isAlert = type === 'alert';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 transform transition-all scale-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${
              isDanger ? 'bg-red-100 text-red-600' : isAlert ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
            }`}>
              {isDanger ? <AlertTriangle size={24} /> : isAlert ? <Info size={24} /> : <AlertTriangle size={24} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">{title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{message}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          {!isAlert && (
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              if (onConfirm) onConfirm();
            }}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-md cursor-pointer ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Memproses...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}