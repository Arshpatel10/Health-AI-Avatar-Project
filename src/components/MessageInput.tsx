"use client";

import { useState } from "react";

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  onTypingChange?: (isTyping: boolean) => void;
  placeholder?: string;
  onMicToggle?: (isMuted: boolean) => void;
  isMicAvailable?: boolean;
}

export default function MessageInput({
  onSend,
  disabled = false,
  onTypingChange,
  placeholder = "Describe your symptoms...",
  onMicToggle,
  isMicAvailable = false,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [isMicMuted, setIsMicMuted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);
    onTypingChange?.(newText.length > 0);
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onSend(trimmed);
      setText("");
      onTypingChange?.(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleMic = () => {
    const newMutedState = !isMicMuted;
    setIsMicMuted(newMutedState);
    onMicToggle?.(newMutedState);
  };

  return (
    <div className="flex items-center gap-3 bg-surface border border-outline-variant rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-sm">
      <button
        type="button"
        className="p-2 hover:bg-surface-variant rounded-lg transition-colors text-on-surface-variant"
        title="Attach file"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
        </svg>
      </button>

      <input
        id="message-input"
        type="text"
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-base text-on-surface py-2 placeholder:text-on-surface-variant"
      />

      <button
        type="button"
        onClick={toggleMic}
        disabled={!isMicAvailable}
        className={`p-2 rounded-lg transition-all ${
          !isMicAvailable
            ? "opacity-50 cursor-not-allowed text-gray-400"
            : isMicMuted
            ? "bg-red-100 text-red-600 hover:bg-red-200"
            : "bg-green-100 text-green-600 hover:bg-green-200"
        }`}
        title={!isMicAvailable ? "Voice not available" : isMicMuted ? "Voice muted - click to unmute" : "Voice active - click to mute"}
      >
        {isMicMuted ? (
          // Muted mic icon (with slash)
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L5 5m14 0v6a7 7 0 01-11.17 5.59M12 19v3m-4 0h8M5 10v1a7 7 0 001.17 3.88" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 9.34V4a3 3 0 00-5.68-1.33" />
          </svg>
        ) : (
          // Active mic icon
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled}
        className="bg-primary text-on-primary p-2.5 rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
        </svg>
      </button>
    </div>
  );
}
