"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChatMessage, EmotionState } from "@/lib/types";
import { getCoachResponse } from "@/lib/mockBackend";
import { getSpeechService, VoiceOption } from "@/lib/speech";
import MessageInput from "./MessageInput";
import MessageBubble from "./MessageBubble";
import Avatar, { AvatarState } from "./Avatar";
import WarningPopup from "./WarningPopup";
import VoiceSelector from "./VoiceSelector";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [fullResponse, setFullResponse] = useState<ChatMessage | null>(null);
  const [userIsTyping, setUserIsTyping] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>("voice1");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentEmotionState, setCurrentEmotionState] = useState<EmotionState>("neutral");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const speechServiceRef = useRef<ReturnType<typeof getSpeechService> | null>(null);

  // Initialize speech service
  useEffect(() => {
    speechServiceRef.current = getSpeechService();
    speechServiceRef.current.setOnSpeakingChange(setIsSpeaking);
  }, []);

  // Update voice when selection changes
  useEffect(() => {
    if (speechServiceRef.current) {
      speechServiceRef.current.setVoiceOption(selectedVoice);
    }
  }, [selectedVoice]);

  // Map emotion state to avatar state for speech tone
  const getAvatarStateForSpeech = useCallback((emotion: EmotionState, guardrailTriggered: boolean): AvatarState => {
    if (guardrailTriggered) return "warning";
    switch (emotion) {
      case "supportive": return "supportive";
      case "warning": return "warning";
      default: return "speaking";
    }
  }, []);

  // Determine avatar state based on current activity
  const getAvatarState = (): AvatarState => {
    if (showWarning) return "warning";
    if (isSpeaking) return "speaking";
    if (isTyping) return "speaking";
    if (isLoading) return "listening";
    if (userIsTyping) return "thinking";
    return "idle";
  };

  const avatarState = getAvatarState();

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, displayedText, isLoading]);

  // Start speech when response comes in
  useEffect(() => {
    if (fullResponse && fullResponse.role === "assistant" && isTyping && displayedText.length === 0) {
      const fullText = fullResponse.response.answer;

      // Trigger speech immediately with appropriate tone
      const speechState = getAvatarStateForSpeech(
        fullResponse.response.emotion_state,
        fullResponse.response.guardrail_triggered
      );
      setCurrentEmotionState(fullResponse.response.emotion_state);

      if (speechServiceRef.current) {
        speechServiceRef.current.speak(fullText, speechState).catch(console.error);
      }
    }
  }, [fullResponse, isTyping, displayedText.length, getAvatarStateForSpeech]);

  // Typing effect - synced with speech timing
  useEffect(() => {
    if (fullResponse && fullResponse.role === "assistant" && isTyping) {
      const fullText = fullResponse.response.answer;

      if (displayedText.length < fullText.length) {
        // Calculate typing speed based on text length
        // Average speech rate is ~150 words per minute, ~750 characters per minute
        // That's about 12.5 chars per second, or 80ms per char
        // We'll use a slightly faster typing speed for better visual experience
        const typingSpeed = Math.max(25, Math.min(50, (fullText.length / 150) * 1000 / fullText.length));

        const timeout = setTimeout(() => {
          setDisplayedText(fullText.slice(0, displayedText.length + 1));
        }, typingSpeed);
        return () => clearTimeout(timeout);
      } else {
        // Typing complete, add the full message to messages array
        setIsTyping(false);
        setMessages((prev) => [...prev, fullResponse]);
        setFullResponse(null);
        setDisplayedText("");
      }
    }
  }, [displayedText, fullResponse, isTyping]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading || isTyping) return;

    const userMessage: ChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await getCoachResponse(text);
      const assistantMessage: ChatMessage = { role: "assistant", response };

      // Check if guardrail was triggered and show warning popup
      if (response.guardrail_triggered) {
        setWarningMessage(response.answer);
        setShowWarning(true);
      }

      // Start typing effect
      setIsLoading(false);
      setFullResponse(assistantMessage);
      setDisplayedText("");
      setIsTyping(true);
    } catch {
      setIsLoading(false);
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
          <button className="p-2 rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </button>
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
          <div className="flex flex-col items-center">
            <Avatar
              width={500}
              height={600}
              isListening={isLoading}
              isSpeaking={isSpeaking}
              state={avatarState}
            />
          </div>

          {/* Voice Selector - Bottom Left */}
          <div className="absolute bottom-6 left-6">
            <VoiceSelector
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
            />
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
            {messages.length === 0 && !isLoading && !isTyping && (
              <div className="flex items-start gap-3 max-w-[85%]">
                <div className="w-9 h-9 rounded-full bg-primary-container flex-shrink-0 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-on-primary-container">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                  </svg>
                </div>
                <div className="bg-primary-container text-on-primary-container p-4 rounded-2xl rounded-tl-none shadow-sm">
                  <p className="text-base leading-relaxed">
                    Hello, I&apos;m your AI health assistant. I&apos;m here to help you navigate your health concerns and analyze your records. How are you feeling today?
                  </p>
                  <span className="text-xs mt-2 block opacity-80">10:42 AM</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-8">
              {messages.map((message, index) => (
                <MessageBubble key={index} message={message} />
              ))}
            </div>

            {/* Thinking indicator with bouncing dots */}
            {isLoading && (
              <div className="flex items-start gap-3 max-w-[85%]">
                <div className="w-9 h-9 rounded-full bg-primary-container flex-shrink-0 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-on-primary-container">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                  </svg>
                </div>
                <div className="bg-primary-container text-on-primary-container px-5 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-on-primary-container/80 rounded-full animate-bounce" style={{ animationDelay: "0s" }}></span>
                  <span className="w-2 h-2 bg-on-primary-container/80 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }}></span>
                  <span className="w-2 h-2 bg-on-primary-container/80 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></span>
                </div>
              </div>
            )}

            {/* Typing effect - showing text as it types */}
            {isTyping && fullResponse && (
              <div className="flex items-start gap-3 max-w-[85%]">
                <div className="w-9 h-9 rounded-full bg-primary-container flex-shrink-0 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-on-primary-container">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                  </svg>
                </div>
                <div className="bg-primary-container text-on-primary-container p-4 rounded-2xl rounded-tl-none shadow-sm">
                  <p className="text-base leading-relaxed">
                    {displayedText}
                    <span className="inline-block w-0.5 h-5 bg-on-primary-container/70 ml-0.5 animate-pulse align-middle"></span>
                  </p>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-6 bg-background border-t border-outline-variant">
            <MessageInput
              onSend={handleSend}
              disabled={isLoading || isTyping}
              onTypingChange={setUserIsTyping}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
