import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-3xl bg-slate-900 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-xl border border-slate-800">
          
          {/* Header */}
          <div className="bg-slate-900 px-6 py-5 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-lg font-bold leading-6 text-white tracking-tight">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 focus:outline-none transition-colors"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="bg-slate-900 px-6 py-6">
            {children}
          </div>

        </div>
      </div>
    </div>
  );
}
