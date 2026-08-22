"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChatMessage, EmotionState } from "@/lib/types";
import { backendErrorResponse, getCoachResponse } from "@/lib/ragBackend";
import MessageInput from "./MessageInput";
import MessageBubble from "./MessageBubble";
import TalkingHeadAvatar, { AvatarState, TalkingHeadAvatarHandle } from "./TalkingHeadAvatar";
import WarningPopup from "./WarningPopup";

// Combined display state for the avatar
type DisplayState = "idle" | "listening" | "thinking" | "speaking" | "supportive" | "warning" | "insufficient" | "disconnected" | "connecting" | "error";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [avatarState, setAvatarState] = useState<AvatarState>("disconnected");
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWarningActive, setIsWarningActive] = useState(false); // Persistent warning state
  const [isTyping, setIsTyping] = useState(false); // Track when user is typing
  const [emotionState, setEmotionState] = useState<EmotionState | null>(null); // Track response emotion
  const [isEvidenceSufficient, setIsEvidenceSufficient] = useState(true); // Track evidence sufficiency
  const [speechSpeed, setSpeechSpeed] = useState(1.0); // Speech speed (0.25 - 4.0)
  const [showVoiceSettings, setShowVoiceSettings] = useState(false); // Toggle voice settings panel
  const chatEndRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<TalkingHeadAvatarHandle>(null);
  const voiceSettingsRef = useRef<HTMLDivElement>(null);
  const pendingTextResponseRef = useRef<string | null>(null); // Track text-initiated responses
  const hasSpokenIntroRef = useRef(false); // Track if intro message has been spoken

  // Initial greeting message
  const INTRO_MESSAGE = "Hello! This health coach provides general educational information about adult health, including maternal health. It does not diagnose symptoms, provide individualized treatment recommendations, or advise on treatment or care for babies or children. Please do not use it for urgent or emergency concerns; contact your healthcare team or local emergency services when appropriate.";

  // Compute the current display state based on all factors
  const getDisplayState = useCallback((): DisplayState => {
    // Text requests remain visible while the avatar is still loading.
    if (isWarningActive) return "warning";
    if (isProcessing) return "thinking";
    if (isTyping) return "listening";
    if (avatarState === "connecting") return "connecting";
    if (avatarState === "error") return "error";
    if (avatarState === "disconnected") return "disconnected";
    if (avatarState === "listening") return "listening";
    if (avatarState === "speaking") return "speaking";
    if (!isEvidenceSufficient) return "insufficient";
    if (emotionState === "supportive") return "supportive";
    return "idle";
  }, [avatarState, isWarningActive, isProcessing, isTyping, emotionState, isEvidenceSufficient]);

  const displayState = getDisplayState();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Speak intro message when avatar connects
  useEffect(() => {
    if (avatarState === "connected" && !hasSpokenIntroRef.current && avatarRef.current) {
      hasSpokenIntroRef.current = true;
      // Small delay to ensure avatar is fully ready
      setTimeout(() => {
        avatarRef.current?.speakText(INTRO_MESSAGE);
      }, 200);
    }
  }, [avatarState]);

  // Close voice settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (voiceSettingsRef.current && !voiceSettingsRef.current.contains(event.target as Node)) {
        setShowVoiceSettings(false);
      }
    };

    if (showVoiceSettings) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showVoiceSettings]);

  // Reset intro flag only on manual disconnect (red button), not avatar switch
  const handleManualDisconnect = useCallback(() => {
    hasSpokenIntroRef.current = false;
  }, []);

  // Handle user transcription through the document-grounded backend.
  const handleUserTranscription = useCallback(async (text: string) => {
    setIsWarningActive(false); // Clear warning state on new voice input
    setEmotionState(null); // Clear emotion state on new input
    setIsEvidenceSufficient(true); // Reset evidence sufficiency

    // Add user message to chat
    const userMessage: ChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMessage]);

    // Interrupt any HeyGen AI response that might be starting
    if (avatarRef.current) {
      avatarRef.current.interrupt();
    }

    setIsProcessing(true);

    try {
      const response = await getCoachResponse(text);

      // Check for warning
      if (response.guardrail_triggered) {
        setWarningMessage(response.answer);
        setShowWarning(true);
        setIsWarningActive(true);
      }

      // Set emotion state and evidence sufficiency based on response
      setEmotionState(response.emotion_state);
      setIsEvidenceSufficient(response.evidence_sufficient);

      // Add assistant message to chat
      const assistantMessage: ChatMessage = { role: "assistant", response };
      setMessages((prev) => [...prev, assistantMessage]);

      // Have the avatar speak the response from our backend
      if (avatarRef.current) {
        pendingTextResponseRef.current = response.answer; // Mark to avoid duplicate in transcription
        avatarRef.current.speakText(response.answer);
      }
    } catch (error) {
      console.error("Error getting response:", error);
      const response = backendErrorResponse(error);
      setIsEvidenceSufficient(false);
      setMessages((prev) => [...prev, { role: "assistant", response }]);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle avatar state changes
  const handleStateChange = useCallback((state: AvatarState) => {
    setAvatarState(state);
  }, []);

  // Handle errors
  const handleError = useCallback((error: string) => {
    console.error("TalkingHead error:", error);
  }, []);

  // Text input uses the RAG backend and asks the avatar to speak when connected.
  const handleSend = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    // Clear states on new text input
    setIsWarningActive(false);
    setEmotionState(null);
    setIsEvidenceSufficient(true);

    // Add user message to chat
    const userMessage: ChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      const response = await getCoachResponse(text);

      // Check for warning
      if (response.guardrail_triggered) {
        setWarningMessage(response.answer);
        setShowWarning(true);
        setIsWarningActive(true);
      }

      // Set emotion state and evidence sufficiency based on response
      setEmotionState(response.emotion_state);
      setIsEvidenceSufficient(response.evidence_sufficient);

      // Add assistant message to chat
      const assistantMessage: ChatMessage = { role: "assistant", response };
      setMessages((prev) => [...prev, assistantMessage]);

      // Have the avatar speak the response
      if (avatarRef.current && (avatarState === "connected" || avatarState === "listening" || avatarState === "speaking")) {
        pendingTextResponseRef.current = response.answer; // Mark as text-initiated to avoid duplicate
        avatarRef.current.speakText(response.answer);
      }
    } catch (error) {
      console.error("Error getting response:", error);
      const response = backendErrorResponse(error);
      setIsEvidenceSufficient(false);
      setMessages((prev) => [...prev, { role: "assistant", response }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Warning Popup */}
      {showWarning && (
        <WarningPopup
          message={warningMessage}
          onClose={() => setShowWarning(false)}
        />
      )}

      {/* Header */}
      <header className="flex justify-between items-center w-full px-6 h-16 sticky top-0 z-50 bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-primary">HealthAI</span>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm transition-colors ${
            displayState === "warning"
              ? "bg-red-100 text-red-700"
              : displayState === "thinking"
              ? "bg-yellow-100 text-yellow-700"
              : displayState === "listening"
              ? "bg-blue-100 text-blue-700"
              : displayState === "speaking"
              ? "bg-purple-100 text-purple-700"
              : displayState === "supportive"
              ? "bg-teal-100 text-teal-700"
              : displayState === "insufficient"
              ? "bg-orange-100 text-orange-700"
              : displayState === "connecting"
              ? "bg-yellow-100 text-yellow-700"
              : displayState === "idle"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-700"
          }`}>
            <span className={`w-2 h-2 rounded-full transition-colors ${
              displayState === "warning"
                ? "bg-red-500 animate-pulse"
                : displayState === "thinking"
                ? "bg-yellow-500 animate-pulse"
                : displayState === "listening"
                ? "bg-blue-500 animate-pulse"
                : displayState === "speaking"
                ? "bg-purple-500 animate-pulse"
                : displayState === "supportive"
                ? "bg-teal-500"
                : displayState === "insufficient"
                ? "bg-orange-500"
                : displayState === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : displayState === "idle"
                ? "bg-green-500"
                : "bg-gray-400"
            }`} />
            {displayState === "idle" && "Ready"}
            {displayState === "listening" && "Listening..."}
            {displayState === "thinking" && "Checking evidence..."}
            {displayState === "speaking" && "Speaking..."}
            {displayState === "supportive" && "Supportive"}
            {displayState === "warning" && "Warning"}
            {displayState === "insufficient" && "Insufficient Evidence"}
            {displayState === "connecting" && "Connecting..."}
            {displayState === "disconnected" && "Disconnected"}
            {displayState === "error" && "Error"}
          </div>
          <button className="p-2 rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center overflow-hidden border-2 border-primary-container">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-on-secondary-container">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-y-auto bg-background lg:flex-row lg:overflow-hidden">
        {/* Avatar Section - Left Side */}
        <section className="relative flex w-full shrink-0 items-center justify-center border-b border-outline-variant bg-gradient-to-b from-surface to-surface-variant py-4 lg:w-1/2 lg:border-b-0 lg:border-r lg:py-0">
          <TalkingHeadAvatar
            ref={avatarRef}
            width={500}
            height={400}
            onStateChange={handleStateChange}
            onUserTranscription={handleUserTranscription}
            onError={handleError}
            onManualDisconnect={handleManualDisconnect}
            autoStart={true}
            speechSpeed={speechSpeed}
          />
        </section>

        {/* Chat Section - Right Side */}
        <section className="flex min-h-[32rem] w-full flex-col lg:h-full lg:min-h-0 lg:w-1/2">
          {/* Chat Scrollable Area */}
          <div
            className="flex-1 overflow-y-auto chat-scroll p-6 space-y-8"
            aria-live="polite"
            aria-atomic="false"
          >
            {messages.length === 0 && (
              <div className="flex items-start gap-3 max-w-[85%]">
                <div className="w-9 h-9 rounded-full bg-primary-container flex-shrink-0 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-on-primary-container">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                  </svg>
                </div>
                <div className="bg-primary-container text-on-primary-container p-4 rounded-2xl rounded-tl-none shadow-sm">
                  <p className="text-base leading-relaxed">
                    {INTRO_MESSAGE}
                  </p>
                  <span className="text-xs mt-2 block opacity-80">Just now</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-8">
              {messages.map((message, index) => (
                <MessageBubble key={index} message={message} />
              ))}
            </div>

            {/* Thinking indicator */}
            {isProcessing && (
              <div className="flex items-start gap-3 max-w-[85%]">
                <div className="w-9 h-9 rounded-full bg-yellow-100 flex-shrink-0 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-yellow-600 animate-spin">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                </div>
                <div className="bg-yellow-100 text-yellow-800 px-5 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                  <span className="text-sm">Checking evidence...</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full animate-bounce" style={{ animationDelay: "0s" }}></span>
                    <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }}></span>
                    <span className="w-1.5 h-1.5 bg-yellow-600 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></span>
                  </span>
                </div>
              </div>
            )}

            {/* Listening indicator (for voice) */}
            {!isProcessing && avatarState === "listening" && (
              <div className="flex items-start gap-3 max-w-[85%]">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-600 animate-pulse">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div className="bg-blue-100 text-blue-800 px-5 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                  <span className="text-sm">Listening...</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0s" }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></span>
                  </span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Box - for text fallback */}
          <div className="bg-background p-4 border-t border-outline-variant sm:p-6">
            <MessageInput
              onSend={handleSend}
              onTypingChange={setIsTyping}
              disabled={isProcessing}
              placeholder={isProcessing ? "Checking the evidence..." : avatarState === "connected" ? "Type a message or speak to the avatar..." : "Ask a general HFpEF or CKM health question..."}
              onMicToggle={(isMuted) => {
                if (avatarRef.current) {
                  if (isMuted) {
                    avatarRef.current.muteVoice();
                  } else {
                    avatarRef.current.unmuteVoice();
                  }
                }
              }}
              isMicAvailable={avatarState === "connected" || avatarState === "listening" || avatarState === "speaking"}
            />
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className={`w-2 h-2 rounded-full transition-colors ${
                displayState === "warning"
                  ? "bg-red-500 animate-pulse"
                  : displayState === "thinking"
                  ? "bg-yellow-500 animate-pulse"
                  : displayState === "listening"
                  ? "bg-blue-500 animate-pulse"
                  : displayState === "speaking"
                  ? "bg-purple-500 animate-pulse"
                  : displayState === "supportive"
                  ? "bg-teal-500"
                  : displayState === "insufficient"
                  ? "bg-orange-500"
                  : displayState === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : displayState === "idle"
                  ? "bg-green-500"
                  : "bg-gray-400"
              }`} />
              <p className="text-xs text-on-surface-variant">
                {displayState === "idle" && "Ready"}
                {displayState === "listening" && "Listening..."}
                {displayState === "thinking" && "Thinking..."}
                {displayState === "speaking" && "Speaking..."}
                {displayState === "supportive" && "Supportive"}
                {displayState === "warning" && "Warning"}
                {displayState === "insufficient" && "Insufficient Evidence"}
                {displayState === "connecting" && "Connecting..."}
                {displayState === "disconnected" && "Disconnected"}
                {displayState === "error" && "Error"}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Voice Settings Panel - Bottom Left Corner */}
      <div className="fixed bottom-4 left-4 z-50" ref={voiceSettingsRef}>
        {/* Toggle Button */}
        <button
          onClick={() => setShowVoiceSettings(!showVoiceSettings)}
          className="p-3 bg-surface border border-outline-variant rounded-full shadow-lg hover:bg-surface-variant transition-colors"
          title="Voice Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-on-surface">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
        </button>

        {/* Settings Panel */}
        {showVoiceSettings && (
          <div className="absolute bottom-14 left-0 bg-surface border border-outline-variant rounded-xl shadow-xl p-4 min-w-[240px]">
            <h3 className="text-sm font-semibold text-on-surface mb-4">Voice Settings</h3>

            {/* Speech Speed */}
            <div className="mb-2">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-on-surface-variant">Speed</label>
                <span className="text-xs font-medium text-on-surface">{speechSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speechSpeed}
                onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
                className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-on-surface-variant mt-1">
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </div>

            {/* Reset Button */}
            <button
              onClick={() => {
                setSpeechSpeed(1.0);
              }}
              className="w-full mt-2 px-3 py-1.5 text-xs text-primary hover:bg-primary-container rounded-lg transition-colors"
            >
              Reset to Default
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
