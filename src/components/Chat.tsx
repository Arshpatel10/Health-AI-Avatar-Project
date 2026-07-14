"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChatMessage, EmotionState } from "@/lib/types";
import { getCoachResponse } from "@/lib/mockBackend";
import MessageInput from "./MessageInput";
import MessageBubble from "./MessageBubble";
import AudioWaveAvatar, { AvatarState, AudioWaveAvatarHandle } from "./AudioWaveAvatar";
import WarningPopup from "./WarningPopup";

// Combined display state for the avatar
type DisplayState = "idle" | "listening" | "thinking" | "speaking" | "supportive" | "warning" | "confused" | "error";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWarningActive, setIsWarningActive] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [emotionState, setEmotionState] = useState<EmotionState | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<AudioWaveAvatarHandle>(null);

  // Compute the current display state based on all factors
  const getDisplayState = useCallback((): DisplayState => {
    if (isWarningActive) return "warning";
    if (isProcessing) return "thinking";
    if (isTyping || avatarState === "listening") return "listening";
    if (avatarState === "speaking") return "speaking";
    if (emotionState === "supportive") return "supportive";
    if (emotionState === "confused") return "confused";
    return "idle";
  }, [avatarState, isWarningActive, isProcessing, isTyping, emotionState]);

  const displayState = getDisplayState();

  // Compute avatar visual state (maps displayState to AvatarState)
  const getAvatarVisualState = useCallback((): AvatarState => {
    if (isWarningActive) return "warning";
    if (isProcessing) return "thinking";
    if (isTyping || avatarState === "listening") return "listening";
    if (avatarState === "speaking") return "speaking";
    return "idle";
  }, [avatarState, isWarningActive, isProcessing, isTyping]);

  const avatarVisualState = getAvatarVisualState();

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle transcription from speech recognition
  const handleTranscription = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsWarningActive(false);
    setEmotionState(null);

    // Stop listening while processing
    if (avatarRef.current) {
      avatarRef.current.stopListening();
    }
    setIsListening(false);

    // Add user message to chat
    const userMessage: ChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMessage]);

    setIsProcessing(true);
    setAvatarState("thinking");

    try {
      const response = await getCoachResponse(text);

      if (response.guardrail_triggered) {
        setWarningMessage(response.answer);
        setShowWarning(true);
        setIsWarningActive(true);
        setAvatarState("warning");
      }

      setEmotionState(response.emotion_state);

      const assistantMessage: ChatMessage = { role: "assistant", response };
      setMessages((prev) => [...prev, assistantMessage]);

      // Have the avatar speak the response
      if (avatarRef.current) {
        avatarRef.current.speak(response.answer);
      }
    } catch (error) {
      console.error("Error getting response:", error);
      setAvatarState("error");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle avatar state changes
  const handleAvatarStateChange = useCallback((state: AvatarState) => {
    // Don't let avatar override warning state
    if (isWarningActive && state !== "warning") return;
    setAvatarState(state);
  }, [isWarningActive]);

  // Handle speaking start - set to speaking unless warning is active
  const handleSpeakingStart = useCallback(() => {
    if (!isWarningActive) {
      setAvatarState("speaking");
    }
    // If warning is active, keep the warning state
  }, [isWarningActive]);

  // Handle speaking end - reset state appropriately
  const handleSpeakingEnd = useCallback(() => {
    if (isWarningActive) {
      setAvatarState("warning");
    } else {
      setAvatarState("idle");
    }
    // Restart listening if it was enabled
    if (isListening) {
      avatarRef.current?.startListening();
    }
  }, [isListening, isWarningActive]);

  // For text input
  const handleSend = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    // Stop any ongoing speech
    if (avatarRef.current) {
      avatarRef.current.stopSpeaking();
    }

    setIsWarningActive(false);
    setEmotionState(null);

    const userMessage: ChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);
    setAvatarState("thinking");

    try {
      const response = await getCoachResponse(text);

      if (response.guardrail_triggered) {
        setWarningMessage(response.answer);
        setShowWarning(true);
        setIsWarningActive(true);
        setAvatarState("warning");
      }

      setEmotionState(response.emotion_state);

      const assistantMessage: ChatMessage = { role: "assistant", response };
      setMessages((prev) => [...prev, assistantMessage]);

      // Have the avatar speak the response
      if (avatarRef.current) {
        avatarRef.current.speak(response.answer);
      }
    } catch (error) {
      console.error("Error getting response:", error);
      setAvatarState("error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle microphone listening
  const handleMicToggle = useCallback((isMuted: boolean) => {
    if (avatarRef.current) {
      if (isMuted) {
        avatarRef.current.stopListening();
        setIsListening(false);
        setAvatarState("idle");
      } else {
        avatarRef.current.startListening();
        setIsListening(true);
        setAvatarState("listening");
      }
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Warning Popup */}
      {showWarning && (
        <WarningPopup
          message={warningMessage}
          onClose={() => setShowWarning(false)}
        />
      )}

      {/* Medical Disclaimer Modal */}
      {showDisclaimer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-lg mx-4 overflow-hidden border border-outline-variant">
            <div className="bg-primary px-6 py-4">
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-on-primary">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <h2 className="text-xl font-bold text-on-primary">Medical Disclaimer</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-on-surface leading-relaxed">
                Welcome to <span className="font-semibold text-primary">HealthAI</span>. Before you begin, please read and acknowledge the following:
              </p>
              <div className="bg-surface-variant rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-primary font-bold">1.</span>
                  <p className="text-on-surface-variant text-sm">This AI assistant provides <span className="font-medium">general health information only</span> and is intended for educational purposes.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-primary font-bold">2.</span>
                  <p className="text-on-surface-variant text-sm">This is <span className="font-medium">not a substitute</span> for professional medical advice, diagnosis, or treatment.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-primary font-bold">3.</span>
                  <p className="text-on-surface-variant text-sm">Always seek the advice of a <span className="font-medium">qualified healthcare provider</span> with any questions regarding a medical condition.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-primary font-bold">4.</span>
                  <p className="text-on-surface-variant text-sm">In case of a <span className="font-medium text-red-600">medical emergency</span>, call your local emergency services immediately.</p>
                </div>
              </div>
              <p className="text-sm text-on-surface-variant text-center">
                By continuing, you acknowledge that you have read and understood this disclaimer.
              </p>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowDisclaimer(false)}
                className="w-full bg-primary text-on-primary py-3 px-6 rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                I Understand, Continue
              </button>
            </div>
          </div>
        </div>
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
              : displayState === "confused"
              ? "bg-orange-100 text-orange-700"
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
                : displayState === "confused"
                ? "bg-orange-500"
                : displayState === "idle"
                ? "bg-green-500"
                : "bg-gray-400"
            }`} />
            {displayState === "idle" && "Ready"}
            {displayState === "listening" && "Listening..."}
            {displayState === "thinking" && "Thinking..."}
            {displayState === "speaking" && "Speaking..."}
            {displayState === "supportive" && "Supportive"}
            {displayState === "warning" && "Warning"}
            {displayState === "confused" && "Unsure"}
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
      <main className="flex flex-1 overflow-hidden bg-background">
        {/* Avatar Section - Left Side */}
        <section className="w-1/2 flex flex-col items-center justify-center border-r border-outline-variant bg-gradient-to-b from-surface to-surface-variant relative">
          <AudioWaveAvatar
            ref={avatarRef}
            state={avatarVisualState}
            onStateChange={handleAvatarStateChange}
            onTranscription={handleTranscription}
            onSpeakingStart={handleSpeakingStart}
            onSpeakingEnd={handleSpeakingEnd}
            size={350}
          />
          {/* Persistent Disclaimer */}
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <p className="text-xs text-on-surface-variant/70 leading-relaxed">
              <span className="font-medium">Disclaimer:</span> This AI assistant provides general health information only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical concerns.
            </p>
          </div>
        </section>

        {/* Chat Section - Right Side */}
        <section className="w-1/2 flex flex-col h-full">
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
                    Hello! I&apos;m your AI Health Assistant. Click the microphone button to speak to me, or type your message below. I&apos;ll respond with voice and text.
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
                  <span className="text-sm">Thinking...</span>
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

          {/* Input Box */}
          <div className="p-6 bg-background border-t border-outline-variant">
            <MessageInput
              onSend={handleSend}
              onTypingChange={setIsTyping}
              disabled={isProcessing}
              placeholder={isProcessing ? "Processing..." : "Type a message or click the mic to speak..."}
              onMicToggle={handleMicToggle}
              isMicAvailable={true}
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
                  : displayState === "confused"
                  ? "bg-orange-500"
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
                {displayState === "confused" && "Unsure"}
                {displayState === "error" && "Error"}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
