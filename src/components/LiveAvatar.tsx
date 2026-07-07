"use client";

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  LiveAvatarSession,
  SessionEvent,
  SessionState,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";

export type LiveAvatarState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "listening"
  | "speaking"
  | "error";

export interface LiveAvatarHandle {
  sendMessage: (text: string) => void;
  speakText: (text: string) => void;
  interrupt: () => void;
  muteVoice: () => void;
  unmuteVoice: () => void;
  isVoiceMuted: () => boolean;
}

interface LiveAvatarProps {
  width?: number;
  height?: number;
  onStateChange?: (state: LiveAvatarState) => void;
  onUserTranscription?: (text: string) => void;
  onAvatarTranscription?: (text: string) => void;
  onError?: (error: string) => void;
  autoStart?: boolean;
}

const LiveAvatar = forwardRef<LiveAvatarHandle, LiveAvatarProps>(function LiveAvatar({
  width = 500,
  height = 600,
  onStateChange,
  onUserTranscription,
  onAvatarTranscription,
  onError,
  autoStart = true,
}, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<LiveAvatarState>("disconnected");
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);

  const updateState = useCallback((newState: LiveAvatarState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  const startSession = useCallback(async () => {
    if (sessionRef.current || isLoading) return;

    setIsLoading(true);
    updateState("connecting");

    try {
      // Get session token from backend
      const response = await fetch("/api/liveavatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || "Failed to create session");
      }

      const { session_token } = await response.json();
      sessionTokenRef.current = session_token;

      // Create LiveAvatar session
      const session = new LiveAvatarSession(session_token, {
        voiceChat: true,
      });

      // Set up event listeners
      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        console.log("Stream ready");
        if (videoRef.current) {
          session.attach(videoRef.current);
        }
        updateState("connected");

        // Start voice chat
        session.voiceChat.start();
      });

      session.on(SessionEvent.SESSION_STATE_CHANGED, (sessionState: SessionState) => {
        console.log("Session state changed:", sessionState);
      });

      session.on(SessionEvent.SESSION_DISCONNECTED, (reason) => {
        console.log("Session disconnected:", reason);
        updateState("disconnected");
        cleanup();
      });

      // Agent events
      session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
        updateState("listening");
      });

      session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
        if (state !== "speaking") {
          updateState("connected");
        }
      });

      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
        updateState("speaking");
      });

      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        updateState("connected");
      });

      session.on(AgentEventsEnum.USER_TRANSCRIPTION, (event) => {
        console.log("User said:", event.text);
        onUserTranscription?.(event.text);
      });

      session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (event) => {
        console.log("Avatar said:", event.text);
        onAvatarTranscription?.(event.text);
      });

      session.on(AgentEventsEnum.SESSION_STOPPED, (event) => {
        console.log("Session stopped:", event.stop_reason);
        updateState("disconnected");
        cleanup();
      });

      // Start the session
      await session.start();
      sessionRef.current = session;

      // Set up keep-alive interval (every 2 minutes)
      keepAliveIntervalRef.current = setInterval(async () => {
        if (sessionTokenRef.current) {
          try {
            await fetch("/api/liveavatar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "keepalive",
                session_token: sessionTokenRef.current,
              }),
            });
          } catch (e) {
            console.error("Keep-alive failed:", e);
          }
        }
      }, 2 * 60 * 1000);

    } catch (error) {
      console.error("Failed to start session:", error);
      updateState("error");
      onError?.(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, updateState, onUserTranscription, onAvatarTranscription, onError, state]);

  const stopSession = useCallback(async () => {
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }

    if (sessionRef.current) {
      try {
        await sessionRef.current.stop();
      } catch (e) {
        console.error("Error stopping session:", e);
      }
      sessionRef.current = null;
    }

    if (sessionTokenRef.current) {
      try {
        await fetch("/api/liveavatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "stop",
            session_token: sessionTokenRef.current,
          }),
        });
      } catch (e) {
        console.error("Error stopping session on backend:", e);
      }
      sessionTokenRef.current = null;
    }

    updateState("disconnected");
  }, [updateState]);

  const cleanup = useCallback(() => {
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    sessionRef.current = null;
    sessionTokenRef.current = null;
  }, []);

  // Send a text message to the avatar
  const sendMessage = useCallback((text: string) => {
    if (sessionRef.current) {
      sessionRef.current.message(text);
    }
  }, []);

  // Make the avatar speak text verbatim
  const speakText = useCallback((text: string) => {
    if (sessionRef.current) {
      sessionRef.current.repeat(text);
    }
  }, []);

  // Interrupt the avatar
  const interrupt = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.interrupt();
    }
  }, []);

  // Mute voice chat (stop listening to user speech)
  const muteVoice = useCallback(() => {
    if (sessionRef.current?.voiceChat) {
      sessionRef.current.voiceChat.stop();
      setIsVoiceMuted(true);
    }
  }, []);

  // Unmute voice chat (resume listening to user speech)
  const unmuteVoice = useCallback(() => {
    if (sessionRef.current?.voiceChat) {
      sessionRef.current.voiceChat.start();
      setIsVoiceMuted(false);
    }
  }, []);

  // Check if voice is muted
  const getIsVoiceMuted = useCallback(() => {
    return isVoiceMuted;
  }, [isVoiceMuted]);

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    sendMessage,
    speakText,
    interrupt,
    muteVoice,
    unmuteVoice,
    isVoiceMuted: getIsVoiceMuted,
  }), [sendMessage, speakText, interrupt, muteVoice, unmuteVoice, getIsVoiceMuted]);

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart) {
      startSession();
    }

    return () => {
      stopSession();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on page unload to prevent orphaned sessions
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionTokenRef.current) {
        // Use sendBeacon for reliable delivery during page unload
        navigator.sendBeacon(
          '/api/liveavatar',
          new Blob(
            [JSON.stringify({ action: 'stop', session_token: sessionTokenRef.current })],
            { type: 'application/json' }
          )
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const stateColors: Record<LiveAvatarState, string> = {
    disconnected: "text-gray-500",
    connecting: "text-yellow-500",
    connected: "text-green-500",
    listening: "text-blue-500",
    speaking: "text-purple-500",
    error: "text-red-500",
  };

  const stateLabels: Record<LiveAvatarState, string> = {
    disconnected: "Disconnected",
    connecting: "Connecting...",
    connected: "Ready",
    listening: "Listening",
    speaking: "Speaking",
    error: "Error",
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative rounded-lg overflow-hidden bg-gray-900"
        style={{ width, height }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }} // Mirror the video
        />

        {/* Loading/connecting overlay */}
        {(state === "disconnected" || state === "connecting" || state === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90">
            {state === "connecting" && (
              <>
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-white text-lg">Connecting to avatar...</p>
              </>
            )}
            {state === "disconnected" && !isLoading && (
              <button
                onClick={startSession}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Start Avatar
              </button>
            )}
            {state === "error" && (
              <>
                <p className="text-red-400 mb-4">Failed to connect</p>
                <button
                  onClick={startSession}
                  className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Retry
                </button>
              </>
            )}
          </div>
        )}

        {/* Stop button when connected */}
        {state !== "disconnected" && state !== "connecting" && state !== "error" && (
          <button
            onClick={stopSession}
            className="absolute top-3 right-3 p-2 bg-red-500/80 hover:bg-red-500 rounded-full text-white transition-colors"
            title="Stop session"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* State indicator */}
      <div className={`mt-4 text-lg font-semibold ${stateColors[state]}`}>
        {stateLabels[state]}
      </div>
    </div>
  );
});

export default LiveAvatar;
