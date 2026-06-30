"use client";

import { useState, useEffect } from "react";
import { VoiceOption, VoiceInfo, getSpeechService } from "@/lib/speech";

interface VoiceSelectorProps {
  selectedVoice: VoiceOption;
  onVoiceChange: (voice: VoiceOption) => void;
}

export default function VoiceSelector({ selectedVoice, onVoiceChange }: VoiceSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [voiceOptions, setVoiceOptions] = useState<VoiceInfo[]>([]);

  useEffect(() => {
    const speechService = getSpeechService();
    setVoiceOptions(speechService.getVoiceOptions());
  }, []);

  const getSelectedVoiceName = () => {
    const option = voiceOptions.find(v => v.id === selectedVoice);
    return option?.name || "Voice 1";
  };

  // Collapsed view - just a small icon button
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="bg-surface/80 backdrop-blur-sm rounded-full p-3 shadow-sm border border-outline-variant hover:bg-surface transition-all flex items-center gap-2"
        title="Voice Settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-primary">
          <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
          <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
        </svg>
        <span className="text-sm font-medium text-on-surface">{getSelectedVoiceName()}</span>
      </button>
    );
  }

  // Expanded view
  return (
    <div className="bg-surface/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-outline-variant max-h-[400px] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-on-surface">Voice Selection</h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant"
          title="Minimize"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {voiceOptions.map((voice, index) => (
          <button
            key={voice.id}
            onClick={() => onVoiceChange(voice.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
              selectedVoice === voice.id
                ? "bg-primary text-on-primary"
                : "bg-surface-variant hover:bg-surface-variant/80 text-on-surface-variant"
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              selectedVoice === voice.id ? "bg-white/20" : "bg-primary-container"
            }`}>
              <span className="text-sm font-bold">{index + 1}</span>
            </div>
            <div className="text-left">
              <div className="text-sm font-medium">{voice.name}</div>
              <div className={`text-xs ${selectedVoice === voice.id ? "text-white/70" : "text-on-surface-variant/70"}`}>
                {voice.description}
              </div>
            </div>
            {selectedVoice === voice.id && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 ml-auto">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-outline-variant">
        <p className="text-xs text-on-surface-variant">
          Voice tone adjusts automatically based on the conversation context.
        </p>
      </div>
    </div>
  );
}
