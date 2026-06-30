"use client";

import { useState } from "react";
import { ChatMessage, EvidenceSource } from "@/lib/types";

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

function EvidenceItem({ source }: { source: EvidenceSource }) {
  const [expanded, setExpanded] = useState(false);
  const title = source.title || `Source: ${source.document_id}`;

  return (
    <div className="border-l-2 border-white/30 pl-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-left text-sm font-medium text-white/90 hover:text-white focus:outline-none focus:underline"
          aria-expanded={expanded}
        >
          <span className="text-xs text-white/70">{expanded ? "▼" : "▶"}</span>
        </button>
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-white/90 hover:text-white hover:underline"
          >
            {title}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 inline-block ml-1">
              <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm4.943-.25a.75.75 0 01.75-.75h5.022a.75.75 0 01.75.75v5.022a.75.75 0 01-1.5 0V6.56l-5.22 5.22a.75.75 0 01-1.06-1.06l5.22-5.22h-3.212a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
          </a>
        ) : (
          <span className="text-sm font-medium text-white/90">{title}</span>
        )}
      </div>
      {expanded && source.snippet && (
        <p className="mt-1 text-xs text-white/80 italic ml-5">{source.snippet}</p>
      )}
    </div>
  );
}

function EvidenceSection({ sources }: { sources: EvidenceSource[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-white/20 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/70">
        Sources
      </p>
      <div className="flex flex-col gap-2">
        {sources.map((source, index) => (
          <EvidenceItem key={`${source.document_id}-${source.chunk_id}-${index}`} source={source} />
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

  return (
    <div className="flex items-start gap-3 max-w-[85%]">
      <div className="w-9 h-9 rounded-full bg-primary-container flex-shrink-0 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-on-primary-container">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
        </svg>
      </div>
      <div className="bg-primary-container text-on-primary-container p-4 rounded-2xl rounded-tl-none shadow-sm">
        <p className="text-base leading-relaxed">{response.answer}</p>
        <span className="text-xs mt-2 block opacity-80">{formatTime()}</span>
        <EvidenceSection sources={response.evidence_used} />
      </div>
    </div>
  );
}
