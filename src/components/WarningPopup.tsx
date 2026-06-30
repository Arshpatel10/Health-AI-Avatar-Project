"use client";

interface WarningPopupProps {
  message: string;
  onClose: () => void;
}

export default function WarningPopup({ message, onClose }: WarningPopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Warning header */}
        <div className="bg-red-500 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6 text-white"
            >
              <path
                fillRule="evenodd"
                d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Urgent Health Warning</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="text-gray-700 text-base leading-relaxed">{message}</p>
        </div>

        {/* Emergency contacts */}
        <div className="px-6 pb-4">
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <p className="text-sm font-semibold text-red-800 mb-2">Emergency Resources:</p>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• Emergency Services: <span className="font-bold">911</span></li>
              <li>• Crisis Hotline: <span className="font-bold">988</span></li>
              <li>• Poison Control: <span className="font-bold">1-800-222-1222</span></li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
          >
            I Understand
          </button>
          <a
            href="tel:911"
            className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors text-center"
          >
            Call 911
          </a>
        </div>
      </div>
    </div>
  );
}
