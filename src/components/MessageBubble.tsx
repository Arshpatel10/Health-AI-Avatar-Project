"use client";

import { ChatMessage, EvidenceItem } from "@/lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
}

function WarningIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function EvidenceItemDisplay({ source }: { source: EvidenceItem }) {
  return (
    <div className="border-l-2 border-black/20 pl-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-black">
          {source.document_id}/{source.chunk_id}
        </span>
        <span className="text-xs text-black/60">
          (score: {source.similarity_score.toFixed(2)})
        </span>
      </div>
    </div>
  );
}

function EvidenceSection({ sources }: { sources: EvidenceItem[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-white/20 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/70">
        Sources
      </p>
      <div className="flex flex-col gap-2">
        {sources.map((source, index) => (
          <EvidenceItemDisplay key={`${source.document_id}-${source.chunk_id}-${index}`} source={source} />
        ))}
      </div>
    </div>
  );
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const formatTime = () => {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (message.role === "user") {
    return (
      <div className="flex items-start gap-3 max-w-[85%] ml-auto flex-row-reverse">
        <div className="w-9 h-9 rounded-full bg-secondary-container flex-shrink-0 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-on-secondary-container">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <div className="bg-surface border border-outline-variant text-on-surface p-4 rounded-2xl rounded-tr-none shadow-sm">
          <p className="text-base leading-relaxed">{message.text}</p>
          <span className="text-xs mt-2 block text-on-surface-variant text-right">{formatTime()}</span>
        </div>
      </div>
    );
  }

  const { response } = message;

  if (response.guardrail_triggered) {
    return (
      <div className="flex items-start gap-3 max-w-[85%]">
        <div className="w-9 h-9 rounded-full bg-error flex-shrink-0 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-on-error">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <div
            role="alert"
            className="rounded-2xl rounded-tl-none border-2 border-error bg-error-container p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-on-error-container">
                <WarningIcon />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-error-container">Urgent</h3>
                <p className="mt-1 text-on-error-container">{response.answer}</p>
              </div>
            </div>
            <span className="text-xs mt-2 block text-on-error-container/70">{formatTime()}</span>
          </div>
        </div>
      </div>
    );
  }

  // Style based on emotion state (now only supportive or warning)
  const emotionStyles: Record<string, { container: string; icon: string; iconColor: string }> = {
    supportive: {
      container: "bg-teal-100 text-teal-900",
      icon: "bg-teal-200",
      iconColor: "text-teal-700",
    },
    warning: {
      container: "bg-red-100 text-red-900",
      icon: "bg-red-200",
      iconColor: "text-red-700",
    },
  };

  const style = emotionStyles[response.emotion_state] || emotionStyles.supportive;

  // Icon for supportive emotion (warning handled separately above)
  const getEmotionIcon = () => {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${style.iconColor}`}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    );
  };

  return (
    <div className="flex items-start gap-3 max-w-[85%]">
      <div className={`w-9 h-9 rounded-full ${style.icon} flex-shrink-0 flex items-center justify-center`}>
        {getEmotionIcon()}
      </div>
      <div className={`${style.container} p-4 rounded-2xl rounded-tl-none shadow-sm`}>
        {response.emotion_state === "supportive" && !response.evidence_sufficient && (
          <span className="text-xs font-medium text-orange-600 mb-1 block">Insufficient Evidence</span>
        )}
        <p className="text-base leading-relaxed">{response.answer}</p>
        <span className="text-xs mt-2 block opacity-80">{formatTime()}</span>
        <EvidenceSection sources={response.evidence_used} />
      </div>
    </div>
  );
}
