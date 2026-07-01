"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChatMessage, EmotionState } from "@/lib/types";
import { getCoachResponse } from "@/lib/mockBackend";
import MessageInput from "./MessageInput";
import MessageBubble from "./MessageBubble";
import LiveAvatar, { LiveAvatarState, LiveAvatarHandle } from "./LiveAvatar";
import WarningPopup from "./WarningPopup";

// Combined display state for the avatar
type DisplayState = "idle" | "listening" | "thinking" | "speaking" | "supportive" | "warning" | "confused" | "disconnected" | "connecting" | "error";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [avatarState, setAvatarState] = useState<LiveAvatarState>("disconnected");
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWarningActive, setIsWarningActive] = useState(false); // Persistent warning state
  const [isTyping, setIsTyping] = useState(false); // Track when user is typing
  const [emotionState, setEmotionState] = useState<EmotionState | null>(null); // Track response emotion
  const chatEndRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<LiveAvatarHandle>(null);
  const pendingTextResponseRef = useRef<string | null>(null); // Track text-initiated responses

  // Compute the current display state based on all factors
  const getDisplayState = useCallback((): DisplayState => {
    // Priority order: disconnected/connecting/error > warning > thinking > listening > speaking > emotion states > idle
    if (avatarState === "disconnected") return "disconnected";
    if (avatarState === "connecting") return "connecting";
    if (avatarState === "error") return "error";
    if (isWarningActive) return "warning";
    if (isProcessing) return "thinking";
    if (isTyping || avatarState === "listening") return "listening";
    if (avatarState === "speaking") return "speaking";
    if (emotionState === "supportive") return "supportive";
    if (emotionState === "confused") return "confused";
    return "idle";
  }, [avatarState, isWarningActive, isProcessing, isTyping, emotionState]);

  const displayState = getDisplayState();

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle user transcription from voice
  const handleUserTranscription = useCallback((text: string) => {
    setIsWarningActive(false); // Clear warning state on new voice input
    setEmotionState(null); // Clear emotion state on new input
    const userMessage: ChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
  }, []);

  // Handle avatar transcription (what the AI says)
  const handleAvatarTranscription = useCallback((text: string) => {
    // Skip if this is a response we initiated via text input (already added to chat)
    if (pendingTextResponseRef.current) {
      // Check if the transcription matches what we sent (allowing for minor differences)
      const pending = pendingTextResponseRef.current.toLowerCase().substring(0, 50);
      const transcribed = text.toLowerCase().substring(0, 50);
      if (pending === transcribed || text.includes(pendingTextResponseRef.current.substring(0, 30))) {
        pendingTextResponseRef.current = null; // Clear the pending response
        return; // Skip adding duplicate
      }
    }

    // Check for warning keywords
    const warningKeywords = ["emergency", "911", "call emergency", "seek immediate", "life-threatening"];
    const isWarning = warningKeywords.some(keyword => text.toLowerCase().includes(keyword));

    if (isWarning) {
      setWarningMessage(text);
      setShowWarning(true);
      setIsWarningActive(true);
      setEmotionState("warning");
    } else {
      setEmotionState("neutral");
    }

    const assistantMessage: ChatMessage = {
      role: "assistant",
      response: {
        answer: text,
        emotion_state: isWarning ? "warning" : "neutral",
        guardrail_triggered: isWarning,
        evidence_used: [],
      },
    };
    setMessages((prev) => [...prev, assistantMessage]);
  }, []);

  // Handle avatar state changes
  const handleStateChange = useCallback((state: LiveAvatarState) => {
    setAvatarState(state);
    setIsProcessing(state === "listening");
  }, []);

  // Handle errors
  const handleError = useCallback((error: string) => {
    console.error("LiveAvatar error:", error);
  }, []);

  // For text input - calls mock backend and has avatar speak the response
  const handleSend = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    // Clear states on new text input
    setIsWarningActive(false);
    setEmotionState(null);

    // Add user message to chat
    const userMessage: ChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // Get response from mock backend
      const response = await getCoachResponse(text);

      // Check for warning
      if (response.guardrail_triggered) {
        setWarningMessage(response.answer);
        setShowWarning(true);
        setIsWarningActive(true);
      }

      // Set emotion state based on response
      setEmotionState(response.emotion_state);

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
          <span className="text-sm text-on-surface-variant px-2 py-1 bg-primary-container rounded-full">
            LiveAvatar
          </span>
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
                : displayState === "confused"
                ? "bg-orange-500"
                : displayState === "connecting"
                ? "bg-yellow-500 animate-pulse"
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
      <main className="flex flex-1 overflow-hidden bg-background">
        {/* Avatar Section - Left Side */}
        <section className="w-1/2 flex items-center justify-center border-r border-outline-variant bg-gradient-to-b from-surface to-surface-variant relative">
          <LiveAvatar
            ref={avatarRef}
            width={500}
            height={600}
            onStateChange={handleStateChange}
            onUserTranscription={handleUserTranscription}
            onAvatarTranscription={handleAvatarTranscription}
            onError={handleError}
            autoStart={true}
          />

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
                    Hello! I&apos;m your AI Health Assistant powered by LiveAvatar. You can speak to me directly - just start talking and I&apos;ll respond. Your conversation will appear here as a transcript.
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

          {/* Input Box - for text fallback */}
          <div className="p-6 bg-background border-t border-outline-variant">
            <MessageInput
              onSend={handleSend}
              onTypingChange={setIsTyping}
              disabled={isProcessing || (avatarState !== "connected" && avatarState !== "listening" && avatarState !== "speaking")}
              placeholder={isProcessing ? "Processing..." : avatarState === "connected" ? "Type a message or speak to the avatar..." : "Waiting for avatar connection..."}
            />
            <p className="text-xs text-center text-on-surface-variant mt-2">
              Type a message or speak directly to the avatar
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
