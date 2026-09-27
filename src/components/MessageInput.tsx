"use client";

import { useState } from "react";

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;  // Disables sending (but allows typing)
  onTypingChange?: (isTyping: boolean) => void;
  placeholder?: string;
}

export default function MessageInput({
  onSend,
  disabled = false,
  onTypingChange,
  placeholder = "Type your question here...",
}: MessageInputProps) {
  const [text, setText] = useState("");

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
      // Only submit if not disabled
      if (!disabled) {
        handleSubmit();
      }
    }
  };

  return (
    <div className="flex w-full min-w-0 items-center gap-2 bg-surface border border-outline-variant rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-sm sm:gap-3 sm:px-4">
      <input
        id="message-input"
        type="text"
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-base text-on-surface py-2 placeholder:text-on-surface-variant"
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        className="flex shrink-0 items-center justify-center rounded-xl bg-primary p-2.5 text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        title="Send message"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
        </svg>
      </button>
    </div>
  );
}
