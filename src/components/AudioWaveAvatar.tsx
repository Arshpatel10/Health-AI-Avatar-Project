"use client";

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from "react";

// Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "warning" | "error";

export interface AudioWaveAvatarHandle {
  speak: (text: string) => void;
  stopSpeaking: () => void;
  startListening: () => void;
  stopListening: () => void;
  isListening: () => boolean;
  isSpeaking: () => boolean;
}

interface AudioWaveAvatarProps {
  state: AvatarState;
  onStateChange?: (state: AvatarState) => void;
  onTranscription?: (text: string) => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  size?: number;
}

// Color schemes for different states
const stateColors: Record<AvatarState, { primary: string; secondary: string; glow: string }> = {
  idle: { primary: "#22c55e", secondary: "#86efac", glow: "rgba(34, 197, 94, 0.3)" },
  listening: { primary: "#3b82f6", secondary: "#93c5fd", glow: "rgba(59, 130, 246, 0.4)" },
  thinking: { primary: "#eab308", secondary: "#fde047", glow: "rgba(234, 179, 8, 0.3)" },
  speaking: { primary: "#a855f7", secondary: "#d8b4fe", glow: "rgba(168, 85, 247, 0.4)" },
  warning: { primary: "#ef4444", secondary: "#fca5a5", glow: "rgba(239, 68, 68, 0.4)" },
  error: { primary: "#6b7280", secondary: "#d1d5db", glow: "rgba(107, 114, 128, 0.2)" },
};

const AudioWaveAvatar = forwardRef<AudioWaveAvatarHandle, AudioWaveAvatarProps>(
  function AudioWaveAvatar({ state, onStateChange, onTranscription, onSpeakingStart, onSpeakingEnd, size = 300 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Speech synthesis and recognition refs
    const synthRef = useRef<SpeechSynthesis | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Animation values
    const wavePhaseRef = useRef(0);
    const amplitudeRef = useRef(0);
    const targetAmplitudeRef = useRef(0);

    // Initialize speech services
    useEffect(() => {
      if (typeof window !== "undefined") {
        synthRef.current = window.speechSynthesis;

        // Initialize speech recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";

          recognition.onresult = (event) => {
            const lastResult = event.results[event.results.length - 1];
            if (lastResult.isFinal) {
              const transcript = lastResult[0].transcript.trim();
              if (transcript && onTranscription) {
                onTranscription(transcript);
              }
            }
          };

          recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            if (event.error !== "no-speech") {
              setIsListening(false);
            }
          };

          recognition.onend = () => {
            // Restart if still supposed to be listening
            if (isListening && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                // Already started
              }
            }
          };

          recognitionRef.current = recognition;
        }
      }

      return () => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        if (synthRef.current) {
          synthRef.current.cancel();
        }
      };
    }, [onTranscription, isListening]);

    // Speak text using Web Speech API
    const speak = useCallback((text: string) => {
      if (!synthRef.current) return;

      // Cancel any ongoing speech
      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to get a good voice
      const voices = synthRef.current.getVoices();
      const preferredVoice = voices.find(v =>
        v.name.includes("Samantha") ||
        v.name.includes("Google") ||
        v.name.includes("Microsoft") ||
        v.lang.startsWith("en")
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        targetAmplitudeRef.current = 1;
        onSpeakingStart?.();
        // Don't override state here - let Chat.tsx control it
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        targetAmplitudeRef.current = 0;
        onSpeakingEnd?.();
        // Don't override state here - let Chat.tsx control it
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        targetAmplitudeRef.current = 0;
        onSpeakingEnd?.();
      };

      utteranceRef.current = utterance;
      synthRef.current.speak(utterance);
    }, [onSpeakingStart, onSpeakingEnd, onStateChange]);

    // Stop speaking
    const stopSpeaking = useCallback(() => {
      if (synthRef.current) {
        synthRef.current.cancel();
        setIsSpeaking(false);
        targetAmplitudeRef.current = 0;
      }
    }, []);

    // Start listening
    const startListening = useCallback(() => {
      if (recognitionRef.current && !isListening) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
          onStateChange?.("listening");
        } catch (e) {
          console.error("Failed to start recognition:", e);
        }
      }
    }, [isListening, onStateChange]);

    // Stop listening
    const stopListening = useCallback(() => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
        onStateChange?.("idle");
      }
    }, [onStateChange]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      speak,
      stopSpeaking,
      startListening,
      stopListening,
      isListening: () => isListening,
      isSpeaking: () => isSpeaking,
    }), [speak, stopSpeaking, startListening, stopListening, isListening, isSpeaking]);

    // Update target amplitude based on state
    useEffect(() => {
      switch (state) {
        case "speaking":
          targetAmplitudeRef.current = 1;
          break;
        case "listening":
          targetAmplitudeRef.current = 0.6;
          break;
        case "thinking":
          targetAmplitudeRef.current = 0.4;
          break;
        case "warning":
          targetAmplitudeRef.current = 0.8;
          break;
        default:
          targetAmplitudeRef.current = 0.2;
      }
    }, [state]);

    // Animation loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const centerX = size / 2;
      const centerY = size / 2;
      const baseRadius = size * 0.25;
      const maxWaveHeight = size * 0.15;
      const numWaves = 3;
      const numPoints = 64;

      const animate = () => {
        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Smooth amplitude transition
        amplitudeRef.current += (targetAmplitudeRef.current - amplitudeRef.current) * 0.1;

        // Update wave phase
        const phaseSpeed = state === "speaking" ? 0.08 : state === "listening" ? 0.05 : 0.02;
        wavePhaseRef.current += phaseSpeed;

        const colors = stateColors[state];

        // Draw glow
        const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.5, centerX, centerY, baseRadius + maxWaveHeight * 2);
        gradient.addColorStop(0, colors.glow);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Draw audio waves (outer to inner)
        for (let w = numWaves - 1; w >= 0; w--) {
          const waveRadius = baseRadius + (w + 1) * (maxWaveHeight / numWaves) * 2;
          const waveAmplitude = maxWaveHeight * amplitudeRef.current * (1 - w * 0.2);
          const alpha = 0.3 + (numWaves - w) * 0.2;

          ctx.beginPath();

          for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;

            // Create organic wave pattern
            const wave1 = Math.sin(angle * 4 + wavePhaseRef.current + w) * waveAmplitude * 0.5;
            const wave2 = Math.sin(angle * 6 - wavePhaseRef.current * 1.3 + w * 0.5) * waveAmplitude * 0.3;
            const wave3 = Math.sin(angle * 8 + wavePhaseRef.current * 0.7 + w * 0.3) * waveAmplitude * 0.2;

            const totalWave = wave1 + wave2 + wave3;
            const r = waveRadius + totalWave;

            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }

          ctx.closePath();
          ctx.strokeStyle = `${colors.secondary}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);

        // Gradient fill for center
        const centerGradient = ctx.createRadialGradient(
          centerX - baseRadius * 0.3,
          centerY - baseRadius * 0.3,
          0,
          centerX,
          centerY,
          baseRadius
        );
        centerGradient.addColorStop(0, colors.secondary);
        centerGradient.addColorStop(1, colors.primary);
        ctx.fillStyle = centerGradient;
        ctx.fill();

        // Draw center icon based on state
        ctx.fillStyle = "white";
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const iconSize = baseRadius * 0.4;

        if (state === "speaking") {
          // Sound wave icon
          const barWidth = iconSize * 0.15;
          const gap = iconSize * 0.25;
          const bars = [0.4, 0.7, 1, 0.7, 0.4];
          bars.forEach((h, i) => {
            const x = centerX - (bars.length / 2 - 0.5) * gap + i * gap - barWidth / 2;
            const barHeight = iconSize * h * (0.8 + Math.sin(wavePhaseRef.current * 3 + i) * 0.2);
            ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
          });
        } else if (state === "listening") {
          // Microphone icon
          ctx.beginPath();
          ctx.arc(centerX, centerY - iconSize * 0.2, iconSize * 0.3, Math.PI, 0);
          ctx.lineTo(centerX + iconSize * 0.3, centerY + iconSize * 0.1);
          ctx.arc(centerX, centerY + iconSize * 0.1, iconSize * 0.3, 0, Math.PI);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(centerX, centerY + iconSize * 0.4);
          ctx.lineTo(centerX, centerY + iconSize * 0.6);
          ctx.moveTo(centerX - iconSize * 0.3, centerY + iconSize * 0.6);
          ctx.lineTo(centerX + iconSize * 0.3, centerY + iconSize * 0.6);
          ctx.stroke();
        } else if (state === "thinking") {
          // Dots loading
          const dotRadius = iconSize * 0.12;
          for (let i = 0; i < 3; i++) {
            const x = centerX + (i - 1) * iconSize * 0.4;
            const bounce = Math.sin(wavePhaseRef.current * 2 + i * 0.5) * iconSize * 0.15;
            ctx.beginPath();
            ctx.arc(x, centerY + bounce, dotRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (state === "warning") {
          // Warning triangle
          ctx.beginPath();
          ctx.moveTo(centerX, centerY - iconSize * 0.5);
          ctx.lineTo(centerX + iconSize * 0.5, centerY + iconSize * 0.4);
          ctx.lineTo(centerX - iconSize * 0.5, centerY + iconSize * 0.4);
          ctx.closePath();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(centerX, centerY - iconSize * 0.15);
          ctx.lineTo(centerX, centerY + iconSize * 0.1);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(centerX, centerY + iconSize * 0.25, iconSize * 0.06, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Idle - simple pulse circle
          const pulseSize = iconSize * 0.3 * (1 + Math.sin(wavePhaseRef.current) * 0.2);
          ctx.beginPath();
          ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
          ctx.fill();
        }

        animationRef.current = requestAnimationFrame(animate);
      };

      animate();

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, [size, state]);

    return (
      <div className="flex flex-col items-center gap-4">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="rounded-full"
          style={{ width: size, height: size }}
        />
        <div className={`text-lg font-semibold transition-colors ${
          state === "idle" ? "text-green-500" :
          state === "listening" ? "text-blue-500" :
          state === "thinking" ? "text-yellow-500" :
          state === "speaking" ? "text-purple-500" :
          state === "warning" ? "text-red-500" :
          "text-gray-500"
        }`}>
          {state === "idle" && "Ready"}
          {state === "listening" && "Listening..."}
          {state === "thinking" && "Thinking..."}
          {state === "speaking" && "Speaking..."}
          {state === "warning" && "Warning"}
          {state === "error" && "Error"}
        </div>
      </div>
    );
  }
);

export default AudioWaveAvatar;
