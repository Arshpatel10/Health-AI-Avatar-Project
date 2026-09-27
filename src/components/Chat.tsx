"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChatMessage, EmotionState } from "@/lib/types";
import { backendErrorResponse, getCoachResponse } from "@/lib/mockBackend";
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
  const [isMicActive, setIsMicActive] = useState(false); // Track if mic is actively listening
  const [showInstructions, setShowInstructions] = useState(false); // Toggle instructions popup
  const chatEndRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<TalkingHeadAvatarHandle>(null);
  const voiceSettingsRef = useRef<HTMLDivElement>(null);
  const pendingTextResponseRef = useRef<string | null>(null); // Track text-initiated responses
  const hasSpokenIntroRef = useRef(false); // Track if intro message has been spoken
  const hasMutedOnStartRef = useRef(false); // Track if we've muted on initial connect
  const waitingForIntroToFinishRef = useRef(false); // Track if we're waiting for intro to finish before starting mic

  // Strip citation references like [lit_doc_149/chunk_8d79c2b36f20] from text for display
  const stripCitationsForDisplay = (text: string): string => {
    return text.replace(/\[lit_doc_\d+\/chunk_[a-f0-9]+\]/gi, "").replace(/\s{2,}/g, " ").trim();
  };

  // Strip citations AND parenthetical content for speaking (avatar shouldn't speak citations or parentheses)
  const stripForSpeaking = (text: string): string => {
    return text
      .replace(/\[lit_doc_\d+\/chunk_[a-f0-9]+\]/gi, "") // Remove citations
      .replace(/\([^)]*\)/g, "") // Remove content inside parentheses
      .replace(/\s{2,}/g, " ") // Collapse multiple spaces
      .trim();
  };

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

  // Speak intro message when avatar connects and mute voice by default
  useEffect(() => {
    if (avatarState === "connected" && avatarRef.current) {
      // Mute voice on first connect (user must click mic button to enable)
      if (!hasMutedOnStartRef.current) {
        hasMutedOnStartRef.current = true;
        avatarRef.current.muteVoice();
        setIsMicActive(false);
      }

      // Try to speak intro message (may be blocked by Safari autoplay)
      // If blocked, it will play when user clicks mic button instead
      if (!hasSpokenIntroRef.current) {
        hasSpokenIntroRef.current = true;
        setTimeout(() => {
          avatarRef.current?.speakText(INTRO_MESSAGE);
        }, 200);
      }
    }
  }, [avatarState]);

  // Toggle microphone listening
  const handleMicToggle = useCallback(() => {
    if (!avatarRef.current) return;

    if (isMicActive) {
      avatarRef.current.muteVoice();
      setIsMicActive(false);
    } else {
      // If avatar is currently speaking (e.g., intro), wait for it to finish
      if (avatarState === "speaking") {
        waitingForIntroToFinishRef.current = true;
        // Safety timeout in case speaking state hangs (Safari autoplay issues)
        setTimeout(() => {
          if (waitingForIntroToFinishRef.current && avatarRef.current) {
            waitingForIntroToFinishRef.current = false;
            avatarRef.current.unmuteVoice();
            setIsMicActive(true);
          }
        }, 5000);
        return;
      }

      avatarRef.current.unmuteVoice();
      setIsMicActive(true);
    }
  }, [isMicActive, avatarState]);

  // Start listening after speaking finishes (if user clicked mic while speaking)
  useEffect(() => {
    if (
      waitingForIntroToFinishRef.current &&
      avatarState === "connected" &&
      avatarRef.current
    ) {
      waitingForIntroToFinishRef.current = false;
      avatarRef.current.unmuteVoice();
      setIsMicActive(true);
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
      // Strip citations and parenthetical content before speaking
      if (avatarRef.current) {
        const textToSpeak = stripForSpeaking(response.answer);
        pendingTextResponseRef.current = textToSpeak; // Mark to avoid duplicate in transcription
        avatarRef.current.speakText(textToSpeak, { guardrailTriggered: response.guardrail_triggered });
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
      // Strip citations and parenthetical content before speaking
      if (avatarRef.current && (avatarState === "connected" || avatarState === "listening" || avatarState === "speaking")) {
        const textToSpeak = stripForSpeaking(response.answer);
        pendingTextResponseRef.current = textToSpeak; // Mark as text-initiated to avoid duplicate
        avatarRef.current.speakText(textToSpeak, { guardrailTriggered: response.guardrail_triggered });
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

      {/* Instructions Popup */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface border-b border-outline-variant p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-on-surface">Test Instructions</h2>
              <button
                onClick={() => setShowInstructions(false)}
                className="p-2 hover:bg-surface-variant rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Test Questions */}
              <section>
                <h3 className="text-lg font-semibold text-on-surface mb-3">Test Questions & Expected Responses</h3>
                <div className="space-y-3 text-sm">
                  <div className="bg-surface-variant p-3 rounded-lg">
                    <p className="font-medium text-on-surface">&quot;hello&quot; / &quot;hi&quot; / &quot;hey&quot;</p>
                    <p className="text-on-surface-variant mt-1">→ Returns greeting with disclaimer about the health coach</p>
                  </div>
                  <div className="bg-surface-variant p-3 rounded-lg">
                    <p className="font-medium text-on-surface">&quot;cholesterol&quot; / &quot;ldl&quot; / &quot;fiber&quot;</p>
                    <p className="text-on-surface-variant mt-1">→ Returns info about soluble fiber and LDL cholesterol</p>
                  </div>
                  <div className="bg-surface-variant p-3 rounded-lg">
                    <p className="font-medium text-on-surface">&quot;water&quot; / &quot;hydration&quot; / &quot;drink&quot;</p>
                    <p className="text-on-surface-variant mt-1">→ Returns hydration guidance (2-3 liters per day)</p>
                  </div>
                  <div className="bg-surface-variant p-3 rounded-lg">
                    <p className="font-medium text-on-surface">&quot;sleep&quot; / &quot;insomnia&quot; / &quot;tired&quot;</p>
                    <p className="text-on-surface-variant mt-1">→ Returns sleep recommendations (7-9 hours)</p>
                  </div>
                  <div className="bg-surface-variant p-3 rounded-lg">
                    <p className="font-medium text-on-surface">&quot;hfpef&quot; / &quot;heart failure preserved&quot;</p>
                    <p className="text-on-surface-variant mt-1">→ Returns info about HFpEF</p>
                  </div>
                </div>
              </section>

              {/* Safety Triggers */}
              <section>
                <h3 className="text-lg font-semibold text-red-600 mb-3">Safety Response Triggers (Fear Mood)</h3>
                <div className="bg-red-50 p-3 rounded-lg text-sm">
                  <p className="text-red-700 mb-2">These keywords trigger emergency responses and set the avatar to fear mood:</p>
                  <ul className="text-red-600 space-y-1 list-disc list-inside">
                    <li><strong>Cardiac/Stroke:</strong> &quot;chest pain&quot;, &quot;can&apos;t breathe&quot;, &quot;shortness of breath&quot;, &quot;left arm numb&quot;, &quot;face drooping&quot;, &quot;slurred speech&quot;</li>
                    <li><strong>Mental Health:</strong> &quot;suicide&quot;, &quot;suicidal&quot;, &quot;kill myself&quot;, &quot;end my life&quot;, &quot;want to die&quot;, &quot;self harm&quot;</li>
                    <li><strong>Severe Acute:</strong> &quot;overdose&quot;, &quot;anaphylaxis&quot;, &quot;severe allergic&quot;, &quot;unconscious&quot;, &quot;passed out&quot;, &quot;seizure&quot;</li>
                  </ul>
                </div>
              </section>

              {/* Mood Commands */}
              <section>
                <h3 className="text-lg font-semibold text-on-surface mb-3">Mood Test Commands</h3>
                <p className="text-sm text-on-surface-variant mb-3">Type these to switch the avatar&apos;s mood (persists until changed):</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-100 p-2 rounded"><code>&quot;neutral mood&quot;</code> or <code>&quot;test neutral&quot;</code></div>
                  <div className="bg-yellow-100 p-2 rounded"><code>&quot;happy mood&quot;</code> or <code>&quot;test happy&quot;</code></div>
                  <div className="bg-red-100 p-2 rounded"><code>&quot;angry mood&quot;</code> or <code>&quot;test angry&quot;</code></div>
                  <div className="bg-blue-100 p-2 rounded"><code>&quot;sad mood&quot;</code> or <code>&quot;test sad&quot;</code></div>
                  <div className="bg-purple-100 p-2 rounded"><code>&quot;fear mood&quot;</code> or <code>&quot;test fear&quot;</code></div>
                  <div className="bg-green-100 p-2 rounded"><code>&quot;disgust mood&quot;</code> or <code>&quot;test disgust&quot;</code></div>
                  <div className="bg-pink-100 p-2 rounded"><code>&quot;love mood&quot;</code> or <code>&quot;test love&quot;</code></div>
                  <div className="bg-indigo-100 p-2 rounded"><code>&quot;sleep mood&quot;</code> or <code>&quot;test sleep&quot;</code></div>
                </div>
              </section>

              {/* Gesture Commands */}
              <section>
                <h3 className="text-lg font-semibold text-on-surface mb-3">Gesture Test Commands</h3>
                <p className="text-sm text-on-surface-variant mb-3">Type these to trigger avatar gestures (persists for 15 seconds after speech ends):</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-surface-variant p-2 rounded"><code>&quot;shrug gesture&quot;</code> or <code>&quot;test shrug&quot;</code></div>
                  <div className="bg-surface-variant p-2 rounded"><code>&quot;point gesture&quot;</code> or <code>&quot;test point&quot;</code></div>
                  <div className="bg-surface-variant p-2 rounded"><code>&quot;handup gesture&quot;</code> or <code>&quot;test handup&quot;</code></div>
                  <div className="bg-surface-variant p-2 rounded"><code>&quot;thumbsup gesture&quot;</code> or <code>&quot;test thumbsup&quot;</code></div>
                  <div className="bg-surface-variant p-2 rounded"><code>&quot;thumbsdown gesture&quot;</code> or <code>&quot;test thumbsdown&quot;</code></div>
                  <div className="bg-surface-variant p-2 rounded"><code>&quot;ok gesture&quot;</code> or <code>&quot;test ok&quot;</code></div>
                  <div className="bg-surface-variant p-2 rounded"><code>&quot;namaste gesture&quot;</code> or <code>&quot;test namaste&quot;</code></div>
                  <div className="bg-surface-variant p-2 rounded"><code>&quot;nod gesture&quot;</code> or <code>&quot;test nod&quot;</code></div>
                  <div className="bg-surface-variant p-2 rounded"><code>&quot;no gesture&quot;</code> or <code>&quot;test shake&quot;</code></div>
                </div>
              </section>

              {/* Default Response */}
              <section>
                <h3 className="text-lg font-semibold text-on-surface mb-3">Default Response</h3>
                <div className="bg-orange-50 p-3 rounded-lg text-sm">
                  <p className="text-orange-700">Any unrecognized query returns: &quot;I don&apos;t have enough information in my reference documents to answer that reliably, so I&apos;d rather not guess.&quot;</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex justify-between items-center w-full px-6 h-16 sticky top-0 z-50 bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-primary">HealthAI</span>
          <span className="hidden sm:inline text-xs text-on-surface-variant max-w-md">
            This AI assistant provides general health information only and is not a substitute for professional medical advice, diagnosis, or treatment.
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Instructions Button */}
          <button
            onClick={() => setShowInstructions(true)}
            className="p-2 rounded-lg hover:bg-surface-variant transition-colors"
            title="Test Instructions"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-on-surface">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </button>
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
        <section className="relative flex w-full shrink-0 flex-col items-center justify-start border-b border-outline-variant bg-gradient-to-b from-surface to-surface-variant py-4 lg:w-1/2 lg:border-b-0 lg:border-r lg:py-0 lg:justify-center">
          <TalkingHeadAvatar
            ref={avatarRef}
            width={500}
            height={400}
            onStateChange={handleStateChange}
            onUserTranscription={handleUserTranscription}
            onError={handleError}
            onManualDisconnect={handleManualDisconnect}
            autoStart={false}
            speechSpeed={speechSpeed}
          />

          {/* Mic Button Below Avatar */}
          <div className="flex flex-col items-center mt-4 mb-2">
            <button
              onClick={handleMicToggle}
              disabled={isProcessing || avatarState === "speaking" || (avatarState !== "connected" && !isMicActive)}
              className={`p-4 rounded-full shadow-lg transition-all duration-200 ${
                isMicActive
                  ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                  : avatarState === "connected" && !isProcessing
                  ? "bg-primary hover:bg-primary/90 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              title={isMicActive ? "Click to stop listening" : avatarState === "speaking" ? "Wait for avatar to finish speaking" : isProcessing ? "Wait for response" : "Click to start voice input"}
            >
              {isMicActive ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            <p className="mt-3 text-sm text-on-surface-variant text-center max-w-xs">
              {isMicActive ? (
                <span className="text-red-600 font-medium">Listening... Click to stop</span>
              ) : avatarState === "speaking" ? (
                <span className="text-purple-600">Wait for avatar to finish speaking...</span>
              ) : isProcessing ? (
                <span className="text-yellow-600">Waiting for response...</span>
              ) : avatarState === "connected" ? (
                "Click the microphone to speak your question"
              ) : (
                "Voice input available when avatar is ready"
              )}
            </p>
          </div>
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
              disabled={isProcessing || avatarState === "speaking"}
              placeholder={avatarState === "speaking" ? "Wait for avatar to finish speaking..." : isProcessing ? "Checking the evidence..." : "Type your health question here..."}
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
