import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'info',
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const typeStyles = {
    danger: {
      icon: 'warning',
      iconClass: 'bg-red-100 text-red-600 border-red-200',
      btnClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
    },
    warning: {
      icon: 'report',
      iconClass: 'bg-amber-100 text-amber-600 border-amber-200',
      btnClass: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500 text-white',
    },
    info: {
      icon: 'info',
      iconClass: 'bg-blue-100 text-blue-600 border-blue-200',
      btnClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white',
    }
  };

  const style = typeStyles[type];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${style.iconClass}`}>
            <span className="material-symbols-outlined text-[24px] font-bold">{style.icon}</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-1">{title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed px-2">{message}</p>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
          <button 
            type="button" 
            onClick={onCancel}
            className="cms-btn-secondary py-2 px-4 text-xs font-semibold cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button 
            type="button" 
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer ${style.btnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
