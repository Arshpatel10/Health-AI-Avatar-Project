"use client";

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";

export type AvatarState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "listening"
  | "speaking"
  | "error";

export interface TalkingHeadAvatarHandle {
  speakText: (text: string) => void;
  interrupt: () => void;
  muteVoice: () => void;
  unmuteVoice: () => void;
  isVoiceMuted: () => boolean;
}

interface TalkingHeadAvatarProps {
  width?: number;
  height?: number;
  onStateChange?: (state: AvatarState) => void;
  onUserTranscription?: (text: string) => void;
  onError?: (error: string) => void;
  onManualDisconnect?: () => void;
  autoStart?: boolean;
  speechSpeed?: number; // Speech speed (0.25 = very slow, 1.0 = normal, 4.0 = very fast)
}

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

// HeadTTS types
interface HeadTTSMessage {
  type: "audio" | "error" | "ready";
  data?: {
    audio: Float32Array;
    sampleRate: number;
    words: string[];
    wtimes: number[];
    wdurations: number[];
    visemes: number[];
    vtimes: number[];
    vdurations: number[];
  };
  error?: string;
}

interface HeadTTSInstance {
  connect: (settings?: Record<string, unknown>) => Promise<void>;
  setup: (settings: { voice?: string; [key: string]: unknown }) => void;
  synthesize: (options: { input: string; voice?: string }) => void;
  clear: () => void;
  onmessage: ((message: HeadTTSMessage) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
    TalkingHead: new (container: HTMLElement, options?: Record<string, unknown>) => TalkingHeadInstance;
    HeadTTS: new (options?: Record<string, unknown>) => HeadTTSInstance;
  }
}

interface TalkingHeadInstance {
  showAvatar: (options: {
    url: string;
    body?: string;
    avatarMood?: string;
    lipsyncLang?: string;
    baseline?: Record<string, number>;
    retarget?: Record<string, { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number }>;
  }) => Promise<void>;
  speakText: (text: string, options?: {
    lipsyncLang?: string;
    avatarMood?: string;
  }) => Promise<void>;
  speakAudio: (data: unknown, options?: Record<string, unknown>, callback?: (word: string) => void) => Promise<void>;
  stopSpeaking: () => void;
  setMood: (mood: string) => void;
  playGesture: (name: string, duration?: number, mirror?: boolean, ms?: number) => void;
  stopGesture: (ms?: number) => void;
  speakEmoji: (emoji: string) => void;
  start: () => void;
  stop: () => void;
  lookAt: (x: number, y: number, z: number) => void;
  onSubtitles?: ((text: string | null) => void) | null;
  isSpeaking?: boolean;
}

// Semantic analysis types
interface SemanticAnalysis {
  mood: string | null;
  gestures: Array<{ name: string; delay: number; duration?: number }>;
}

// Semantic keyword mappings for gestures and moods
const SEMANTIC_MAPPINGS = {
  // Emergency/Warning keywords - trigger concerned mood
  emergency: {
    keywords: ["emergency", "911", "call emergency", "urgent", "immediately", "right away", "seek emergency", "medical emergency", "crisis"],
    mood: "fear",
    gestures: [{ name: "handup", delay: 0, duration: 3 }]
  },
  warning: {
    keywords: ["warning", "caution", "careful", "danger", "risk", "serious", "critical"],
    mood: "sad",
    gestures: []
  },
  // Negative/No - head shake
  negative: {
    keywords: ["no,", "no.", "don't", "do not", "avoid", "never", "cannot", "shouldn't", "should not", "won't", "not recommended", "not a substitute"],
    mood: null,
    gestures: [{ name: "no", delay: 0, duration: 2 }]
  },
  // Positive/Yes - head nod and happy mood
  positive: {
    keywords: ["yes", "correct", "exactly", "great", "excellent", "good news", "wonderful", "fantastic", "absolutely"],
    mood: "happy",
    gestures: [{ name: "yes", delay: 0, duration: 2 }]
  },
  // Greeting - happy mood and wave
  greeting: {
    keywords: ["hello", "hi!", "welcome", "good morning", "good afternoon", "good evening", "nice to meet"],
    mood: "happy",
    gestures: [{ name: "handup", delay: 0, duration: 2 }]
  },
  // Uncertainty - shrug
  uncertainty: {
    keywords: ["maybe", "perhaps", "not sure", "uncertain", "might", "could be", "i don't know", "hard to say", "depends"],
    mood: null,
    gestures: [{ name: "shrug", delay: 0, duration: 2 }]
  },
  // Emphasis/Important - pointing
  emphasis: {
    keywords: ["important", "remember", "note that", "keep in mind", "please", "must", "essential", "crucial", "key point"],
    mood: null,
    gestures: [{ name: "index", delay: 0, duration: 2 }]
  },
  // Supportive/Caring
  supportive: {
    keywords: ["here to help", "support", "care", "understand", "i'm sorry", "that's okay", "don't worry"],
    mood: "love",
    gestures: []
  },
  // Thinking/Considering
  thinking: {
    keywords: ["let me think", "considering", "based on", "according to", "research shows", "studies suggest"],
    mood: "neutral",
    gestures: []
  }
};

/**
 * Analyzes text for semantic content and returns appropriate mood and gestures
 */
function analyzeTextSemantics(text: string): SemanticAnalysis {
  const lowerText = text.toLowerCase();
  let mood: string | null = null;
  const gestures: Array<{ name: string; delay: number; duration?: number }> = [];
  const usedGestures = new Set<string>();

  // Check each mapping category (priority order matters)
  const categories = ["emergency", "warning", "negative", "positive", "greeting", "uncertainty", "emphasis", "supportive", "thinking"];

  for (const category of categories) {
    const mapping = SEMANTIC_MAPPINGS[category as keyof typeof SEMANTIC_MAPPINGS];
    const hasMatch = mapping.keywords.some(keyword => lowerText.includes(keyword));

    if (hasMatch) {
      // Set mood (first match wins)
      if (!mood && mapping.mood) {
        mood = mapping.mood;
      }

      // Add gestures (avoid duplicates)
      for (const gesture of mapping.gestures) {
        if (!usedGestures.has(gesture.name)) {
          gestures.push(gesture);
          usedGestures.add(gesture.name);
        }
      }
    }
  }

  return { mood, gestures };
}

const TalkingHeadAvatar = forwardRef<TalkingHeadAvatarHandle, TalkingHeadAvatarProps>(
  function TalkingHeadAvatar(
    {
      width = 500,
      height = 500,
      onStateChange,
      onUserTranscription,
      onError,
      onManualDisconnect,
      autoStart = true,
      speechSpeed = 1.0,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const headRef = useRef<TalkingHeadInstance | null>(null);
    const headTTSRef = useRef<HeadTTSInstance | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const speechRecognitionBlockedRef = useRef(false);
    const scriptLoadedRef = useRef(false);
    const speakResolveRef = useRef<(() => void) | null>(null);
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const speakingEndedTimeRef = useRef<number>(0); // Timestamp when speaking ended
    const hasEverSpokenRef = useRef(false); // Track if avatar has ever spoken (for delayed recognition start)
    const lastSpokenTextRef = useRef<string>(""); // Track what avatar just said to filter it out

    const [state, setState] = useState<AvatarState>("disconnected");
    const [isLoading, setIsLoading] = useState(false);
    const [isVoiceMuted, setIsVoiceMuted] = useState(false);
    const isVoiceMutedRef = useRef(false); // Ref to track muted state for callbacks
    const [isSpeaking, setIsSpeaking] = useState(false);
    const isSpeakingRef = useRef(false); // Ref to track speaking state for callbacks
    const [avatarType, setAvatarType] = useState<"female" | "male">("female");
    const avatarTypeRef = useRef<"female" | "male">("female");
    const [showVoiceMenu, setShowVoiceMenu] = useState(false);
    const voiceMenuRef = useRef<HTMLDivElement>(null);
    const [femaleVoice, setFemaleVoice] = useState("af_bella");
    const [maleVoice, setMaleVoice] = useState("am_fenrir");
    const femaleVoiceRef = useRef("af_bella");
    const maleVoiceRef = useRef("am_fenrir");

    // Available HeadTTS voices
    const femaleVoices = [
      { id: "af_bella", name: "Bella" },
      { id: "af_heart", name: "Heart" },
      { id: "af_nova", name: "Nova" },
      { id: "af_sky", name: "Sky" },
    ];
    const maleVoices = [
      { id: "am_fenrir", name: "Fenrir" },
      { id: "am_adam", name: "Adam" },
      { id: "am_echo", name: "Echo" },
      { id: "am_eric", name: "Eric" },
    ];

    // All voice IDs for pre-loading
    const allVoiceIds = ["af_bella", "af_heart", "af_nova", "af_sky", "am_fenrir", "am_adam", "am_echo", "am_eric"];

    const updateState = useCallback(
      (newState: AvatarState) => {
        setState(newState);
        onStateChange?.(newState);
      },
      [onStateChange]
    );

    // Load TalkingHead and HeadTTS scripts (self-hosted)
    // Scripts are preloaded in layout.tsx for faster startup
    const loadScript = useCallback((): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if already loaded (from preload or previous call)
        if (window.TalkingHead && window.HeadTTS) {
          scriptLoadedRef.current = true;
          resolve();
          return;
        }

        // Wait for preload script to complete
        const handleLoad = () => {
          scriptLoadedRef.current = true;
          window.removeEventListener('talkinghead-loaded', handleLoad);
          resolve();
        };

        window.addEventListener('talkinghead-loaded', handleLoad);

        // Fallback: If preload hasn't started yet, load manually
        // TalkingHead is self-hosted, HeadTTS stays on CDN (has complex AI dependencies)
        if (!scriptLoadedRef.current) {
          const existingScript = document.querySelector('script[data-talkinghead-loader]');
          if (!existingScript) {
            const script = document.createElement("script");
            script.type = "module";
            script.setAttribute('data-talkinghead-loader', 'true');
            script.innerHTML = `
              import { TalkingHead } from "/lib/talkinghead.mjs";
              import { HeadTTS } from "https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/+esm";
              window.TalkingHead = TalkingHead;
              window.HeadTTS = HeadTTS;
              window.dispatchEvent(new Event('talkinghead-loaded'));
            `;
            document.head.appendChild(script);
          }
        }

        // Timeout after 30 seconds
        setTimeout(() => {
          if (!window.TalkingHead || !window.HeadTTS) {
            window.removeEventListener('talkinghead-loaded', handleLoad);
            reject(new Error("Failed to load TalkingHead/HeadTTS scripts"));
          }
        }, 30000);
      });
    }, []);

    // Initialize speech recognition
    const initSpeechRecognition = useCallback(() => {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionAPI) {
        console.warn("Speech recognition not supported in this browser");
        return null;
      }

      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true; // Enable to detect when user starts speaking
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Ignore speech recognition results while avatar is speaking
        if (isSpeakingRef.current) {
          return;
        }

        // Ignore results within 2000ms after speaking ended (to avoid echo pickup)
        const timeSinceSpeakingEnded = Date.now() - speakingEndedTimeRef.current;
        if (speakingEndedTimeRef.current > 0 && timeSinceSpeakingEnded < 2000) {
          console.log(`[Speech] Ignoring result within cooldown period (${timeSinceSpeakingEnded}ms since speaking ended)`);
          return;
        }

        // Get the recognition result
        const result = event.results[event.resultIndex];
        const transcriptLower = result[0]?.transcript?.trim().toLowerCase() || "";

        // Check if the transcript matches what the avatar just said (echo detection)
        const lastSpoken = lastSpokenTextRef.current.toLowerCase();
        if (lastSpoken && transcriptLower.length > 3) {
          // Check if the transcript is a substring of what was just spoken
          if (lastSpoken.includes(transcriptLower) || transcriptLower.includes(lastSpoken.substring(0, 50))) {
            console.log(`[Speech] Ignoring echo of avatar speech: "${transcriptLower}"`);
            return;
          }
        }

        // Clear any existing silence timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }

        // Switch to "listening" state when we detect voice (interim or final result)
        updateState("listening");

        if (result.isFinal) {
          const transcript = result[0].transcript.trim();
          if (transcript) {
            onUserTranscription?.(transcript);
          }
          // After final result, return to connected after brief delay
          silenceTimeoutRef.current = setTimeout(() => {
            if (!isSpeakingRef.current) {
              updateState("connected");
            }
          }, 500);
        } else {
          // For interim results, set timeout to return to idle after silence
          silenceTimeoutRef.current = setTimeout(() => {
            if (!isSpeakingRef.current) {
              updateState("connected");
            }
          }, 2000); // Return to idle after 2 seconds of silence
        }
      };

      recognition.onerror = (event: Event & { error?: string }) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          speechRecognitionBlockedRef.current = true;
          console.warn("Speech recognition is unavailable because microphone access was denied.");
          return;
        }

        // Only log non-trivial errors (not "no-speech" or "aborted")
        if (event.error && event.error !== "no-speech" && event.error !== "aborted") {
          console.warn("Speech recognition error:", event.error);
        }
      };

      recognition.onend = () => {
        if (speechRecognitionBlockedRef.current) {
          return;
        }

        // Don't restart if avatar is speaking - wait until speaking finishes
        if (isSpeakingRef.current) {
          console.log("[Speech] Recognition ended while avatar speaking, not restarting");
          return;
        }

        // Don't restart if we're in the cooldown period after speaking
        const timeSinceSpeakingEnded = Date.now() - speakingEndedTimeRef.current;
        if (speakingEndedTimeRef.current > 0 && timeSinceSpeakingEnded < 2000) {
          console.log(`[Speech] Recognition ended during cooldown (${timeSinceSpeakingEnded}ms), not restarting`);
          return;
        }

        // Restart if not muted.
        if (!isVoiceMutedRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
            console.log("[Speech] Recognition restarted from onend");
          } catch (e) {
            // Ignore - may already be running
          }
        }
      };

      recognition.onstart = () => {
        // Don't change state here - stay in "connected" (idle) until user actually speaks
        // The "listening" state will be triggered by interim results or typing
        console.log("[Speech] Recognition started, staying in idle state");
      };

      return recognition;
    }, [onUserTranscription, updateState]);

    // Initialize the avatar
    const startSession = useCallback(async () => {
      if (headRef.current || isLoading) return;

      setIsLoading(true);
      updateState("connecting");

      try {
        // Load TalkingHead script
        await loadScript();

        if (!containerRef.current) {
          throw new Error("Container not found");
        }

        // Clear container
        containerRef.current.innerHTML = "";

        // Create TalkingHead instance (using HeadTTS for voice)
        const isMale = avatarTypeRef.current === "male";

        // Camera settings per avatar
        const cameraSettings = isMale
          ? { view: "full", distance: -7, x: 0, y: -2.5, rotateX: 0, rotateY: 0 }  // Male
          : { view: "full", distance: -7, x: 0, y: -2, rotateX: 0, rotateY: 0 }; // Female

        const head = new window.TalkingHead(containerRef.current, {
          cameraView: cameraSettings.view,
          cameraDistance: cameraSettings.distance,
          cameraX: cameraSettings.x,
          cameraY: cameraSettings.y,
          cameraRotateX: cameraSettings.rotateX,
          cameraRotateY: cameraSettings.rotateY,
          // Disable user camera controls (no rotating/panning/zooming)
          cameraRotateEnable: false,
          cameraPanEnable: false,
          cameraZoomEnable: false,
          // Lighting adjustments (defaults: ambient=2, direct=30)
          lightAmbientIntensity: 1.5,
          lightDirectIntensity: 14,
        });

        // Get the initial voice based on avatar type
        const initialVoice = isMale ? maleVoiceRef.current : femaleVoiceRef.current;

        // Setup message handler function (used for both new and existing instances)
        const setupMessageHandler = (tts: HeadTTSInstance) => {
          tts.onmessage = (message: HeadTTSMessage) => {
            if (message.type === "audio" && message.data && headRef.current) {
              // Pass audio data to TalkingHead for lip-sync playback
              headRef.current.speakAudio(message.data, {}, () => {
                // Audio finished
                setIsSpeaking(false);
                isSpeakingRef.current = false;
                speakingEndedTimeRef.current = Date.now(); // Mark when speaking ended
                updateState("connected");

                // Reset mood to neutral and stop any gestures
                if (headRef.current) {
                  headRef.current.setMood("neutral");
                  headRef.current.stopGesture(500);
                }

                // Resume speech recognition after speaking completes with delay
                // to avoid picking up echo/reverb of avatar's voice
                setTimeout(() => {
                  // Clear the last spoken text after cooldown
                  lastSpokenTextRef.current = "";

                  if (
                    recognitionRef.current &&
                    !speechRecognitionBlockedRef.current &&
                    !isVoiceMutedRef.current &&
                    !isSpeakingRef.current
                  ) {
                    try {
                      recognitionRef.current.start();
                      console.log("[Speech] Recognition restarted after speaking cooldown");
                    } catch (e) {
                      // Ignore - may already be running
                    }
                  }
                }, 1500); // Wait 1500ms before listening again

                if (speakResolveRef.current) {
                  speakResolveRef.current();
                  speakResolveRef.current = null;
                }
              });
            }
          };
        };

        // Reuse existing HeadTTS if available, otherwise create new
        if (headTTSRef.current) {
          console.log(`[HeadTTS] Reusing existing instance, setting voice: ${initialVoice}`);
          headTTSRef.current.setup({ voice: initialVoice });
          setupMessageHandler(headTTSRef.current);
          console.log(`[HeadTTS] Setup voice: ${initialVoice}`);
        } else {
          console.log(`[HeadTTS] Creating new instance with voice: ${initialVoice}`);
          console.log(`[HeadTTS] Pre-loading voices:`, allVoiceIds);

          // Initialize HeadTTS (free, browser-based TTS with lip-sync)
          // HeadTTS stays on CDN due to complex AI dependencies (transformers, workers)
          const headtts = new window.HeadTTS({
            endpoints: ["webgpu", "wasm"],  // Try WebGPU first, fallback to WASM
            languages: ["en-us"],
            voice: initialVoice,    // Set default voice based on avatar gender
            voices: allVoiceIds,    // Pre-load all voices for voice switching
            // CDN paths for worker and dictionaries
            workerModule: "https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/modules/worker-tts.mjs",
            dictionaryURL: "https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/dictionaries/",
          });

          // Connect to HeadTTS with all pre-loaded voices
          await headtts.connect({
            voices: allVoiceIds
          });

          // Use setup() to set the initial voice (HeadTTS is stateful)
          headtts.setup({ voice: initialVoice });

          headTTSRef.current = headtts;
          setupMessageHandler(headtts);
          console.log(`[HeadTTS] Connected and setup with voice: ${initialVoice}`);
        }

        // ===========================================
        // Avatar Configuration (RPM-compatible avatar)
        // ===========================================
        const avatarUrl = avatarTypeRef.current === "male" ? "/avatar-male.glb" : "/avatar.glb";
        const avatarBody = avatarTypeRef.current === "male" ? "M" : "F";

        // Baseline pose adjustments per avatar (headRotateX: negative = look up, positive = look down)
        const avatarBaseline: Record<string, number> = isMale
          ? { headRotateX: -0.15 }  // Male: tilt head up slightly
          : {};                      // Female: no adjustment

        const avatarOptions = {
          url: avatarUrl,
          body: avatarBody,
          lipsyncLang: "en",
          ...(Object.keys(avatarBaseline).length > 0 && { baseline: avatarBaseline }),
        };

        console.log("[TalkingHead] showAvatar options:", JSON.stringify(avatarOptions, null, 2));

        // Load avatar from local public folder
        await head.showAvatar(avatarOptions);


        headRef.current = head;
        updateState("connected");

        // Initialize speech recognition for voice input (but don't start it yet)
        // Recognition will be started after the first speaking finishes (intro message)
        // This prevents picking up the avatar's voice during the intro
        const recognition = initSpeechRecognition();
        if (recognition) {
          recognitionRef.current = recognition;
          // Don't start immediately - will be started after first speakText completes
          // But if no speaking happens within 2 seconds (e.g., avatar switch), start recognition
          setTimeout(() => {
            if (
              !hasEverSpokenRef.current &&
              recognitionRef.current &&
              !speechRecognitionBlockedRef.current &&
              !isVoiceMutedRef.current
            ) {
              try {
                recognitionRef.current.start();
                console.log("[Speech] Recognition started (no intro message)");
              } catch (e) {
                // Ignore
              }
            }
          }, 2000);
        }
      } catch (error) {
        console.error("Failed to start TalkingHead:", error);
        updateState("error");
        onError?.(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }, [isLoading, updateState, loadScript, initSpeechRecognition, onError]);

    // Speak text using HeadTTS (free, browser-based) with lip-sync
    const speakText = useCallback(
      async (text: string) => {
        if (!headRef.current || !headTTSRef.current) return;

        try {
          setIsSpeaking(true);
          isSpeakingRef.current = true;
          hasEverSpokenRef.current = true;
          lastSpokenTextRef.current = text; // Track what we're saying for echo detection
          updateState("speaking");

          // Abort speech recognition while speaking to prevent picking up avatar's voice
          // Using abort() instead of stop() to discard any buffered audio
          if (recognitionRef.current) {
            try {
              recognitionRef.current.abort();
            } catch (e) {
              // Ignore - may not be running
            }
          }

          // Analyze text for semantic content (mood and gestures)
          const semantics = analyzeTextSemantics(text);
          console.log(`[Semantics] Analysis:`, semantics);

          // Set mood based on semantic analysis
          if (semantics.mood && headRef.current) {
            headRef.current.setMood(semantics.mood);
            console.log(`[Mood] Set to: ${semantics.mood}`);
          }

          // Schedule gestures based on semantic analysis
          for (const gesture of semantics.gestures) {
            setTimeout(() => {
              if (headRef.current && isSpeakingRef.current) {
                headRef.current.playGesture(gesture.name, gesture.duration || 2, false, 500);
                console.log(`[Gesture] Playing: ${gesture.name}`);
              }
            }, gesture.delay);
          }

          // Get current voice based on avatar type (read refs directly for latest values)
          const currentAvatarType = avatarTypeRef.current;
          const voice = currentAvatarType === "male"
            ? maleVoiceRef.current
            : femaleVoiceRef.current;

          console.log(`[TTS] Speaking with avatar: ${currentAvatarType}, voice: ${voice}, speed: ${speechSpeed}`);

          // Use setup() to set the voice and speed before synthesizing (required by HeadTTS)
          headTTSRef.current!.setup({
            voice: voice,
            speed: speechSpeed,
          });

          // Use HeadTTS to synthesize speech
          // The onmessage handler will pass audio to TalkingHead for lip-sync
          // Recognition is resumed in the audio finish callback
          await new Promise<void>((resolve) => {
            speakResolveRef.current = resolve;
            headTTSRef.current!.synthesize({
              input: text,
            });
          });
        } catch (error) {
          console.error("Error speaking:", error);
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          speakingEndedTimeRef.current = Date.now();
          updateState("connected");
          // Try to resume recognition on error with delay
          setTimeout(() => {
            if (
              recognitionRef.current &&
              !speechRecognitionBlockedRef.current &&
              !isVoiceMutedRef.current &&
              !isSpeakingRef.current
            ) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                // Ignore
              }
            }
          }, 1500);
        }
      },
      [updateState, speechSpeed]
    );

    // Stop speaking
    const interrupt = useCallback(() => {
      if (headTTSRef.current) {
        headTTSRef.current.clear();
      }
      if (headRef.current) {
        headRef.current.stopSpeaking();
        headRef.current.setMood("neutral");
        headRef.current.stopGesture(300);
      }
      if (speakResolveRef.current) {
        speakResolveRef.current();
        speakResolveRef.current = null;
      }
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      speakingEndedTimeRef.current = Date.now();
      updateState("connected");
    }, [updateState]);

    // Mute voice (stop listening)
    const muteVoice = useCallback(() => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore
        }
      }
      setIsVoiceMuted(true);
      isVoiceMutedRef.current = true;
    }, []);

    // Unmute voice (start listening)
    const unmuteVoice = useCallback(() => {
      setIsVoiceMuted(false);
      isVoiceMutedRef.current = false;
      if (
        recognitionRef.current &&
        !speechRecognitionBlockedRef.current &&
        state === "connected"
      ) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Ignore - may already be running
        }
      }
    }, [state]);

    const getIsVoiceMuted = useCallback(() => {
      return isVoiceMuted;
    }, [isVoiceMuted]);

    // Expose methods to parent
    useImperativeHandle(
      ref,
      () => ({
        speakText,
        interrupt,
        muteVoice,
        unmuteVoice,
        isVoiceMuted: getIsVoiceMuted,
      }),
      [speakText, interrupt, muteVoice, unmuteVoice, getIsVoiceMuted]
    );

    // Stop session (but optionally keep HeadTTS instance to preserve worker state)
    const stopSession = useCallback((keepTTS?: boolean) => {
      // Clear silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore
        }
        recognitionRef.current = null;
      }

      if (headTTSRef.current && !keepTTS) {
        headTTSRef.current.clear();
        headTTSRef.current = null;
        // Reset hasEverSpoken on full disconnect so intro plays again
        hasEverSpokenRef.current = false;
      }

      if (headRef.current) {
        headRef.current.stop();
        headRef.current = null;
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }

      updateState("disconnected");
    }, [updateState]);

    // Switch avatar type
    const switchAvatar = useCallback(() => {
      // Stop any ongoing speech immediately
      if (headTTSRef.current) {
        headTTSRef.current.clear();
      }
      if (headRef.current) {
        headRef.current.stopSpeaking();
      }
      if (speakResolveRef.current) {
        speakResolveRef.current();
        speakResolveRef.current = null;
      }
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      lastSpokenTextRef.current = "";

      const newType = avatarTypeRef.current === "female" ? "male" : "female";
      avatarTypeRef.current = newType;
      setAvatarType(newType);
      setShowVoiceMenu(false);

      // Reset hasEverSpoken so the delayed recognition start works after switch
      hasEverSpokenRef.current = false;

      const newVoice = newType === "male" ? maleVoiceRef.current : femaleVoiceRef.current;
      console.log(`[Avatar] Switching to ${newType} avatar with voice: ${newVoice}`);

      // Use setup() to change voice (HeadTTS is stateful)
      if (headTTSRef.current) {
        headTTSRef.current.setup({ voice: newVoice });
        console.log(`[HeadTTS] Setup voice: ${newVoice}`);
      }

      // Stop avatar session (keep TTS) and restart with new avatar model
      if (headRef.current) {
        stopSession(true); // Keep TTS instance
        setTimeout(() => {
          startSession();
        }, 100);
      }
    }, [stopSession, startSession]);

    // Change voice for current avatar
    // HeadTTS uses setup() to change voice settings
    const changeVoice = useCallback((voiceId: string) => {
      // Update the ref
      if (avatarTypeRef.current === "male") {
        maleVoiceRef.current = voiceId;
        setMaleVoice(voiceId);
      } else {
        femaleVoiceRef.current = voiceId;
        setFemaleVoice(voiceId);
      }
      setShowVoiceMenu(false);
      console.log(`[Voice] Changed to: ${voiceId} for ${avatarTypeRef.current} avatar`);

      // Use setup() to change voice (HeadTTS is stateful)
      if (headTTSRef.current) {
        headTTSRef.current.setup({ voice: voiceId });
        console.log(`[HeadTTS] Setup voice: ${voiceId}`);
      }
    }, []);

    // Auto-start on mount
    useEffect(() => {
      if (autoStart) {
        startSession();
      }

      return () => {
        stopSession();
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Close voice menu when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (voiceMenuRef.current && !voiceMenuRef.current.contains(event.target as Node)) {
          setShowVoiceMenu(false);
        }
      };

      if (showVoiceMenu) {
        document.addEventListener("mousedown", handleClickOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [showVoiceMenu]);

    const stateColors: Record<AvatarState, string> = {
      disconnected: "text-gray-500",
      connecting: "text-yellow-500",
      connected: "text-green-500",
      listening: "text-blue-500",
      speaking: "text-purple-500",
      error: "text-red-500",
    };

    const stateLabels: Record<AvatarState, string> = {
      disconnected: "Disconnected",
      connecting: "Loading Avatar...",
      connected: "Ready",
      listening: "Listening",
      speaking: "Speaking",
      error: "Error",
    };

    return (
      <div className="flex w-full flex-col items-center px-4">
        <div
          className="relative w-full max-w-[500px] overflow-hidden rounded-lg bg-gradient-to-b from-blue-100 to-blue-200"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          {/* TalkingHead container */}
          <div
            ref={containerRef}
            className="h-full w-full"
          />

          {/* Loading/connecting overlay */}
          {(state === "disconnected" || state === "connecting" || state === "error") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90">
              {state === "connecting" && (
                <>
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-white text-lg">Loading 3D Avatar...</p>
                  <p className="text-gray-400 text-sm mt-2">This may take a moment</p>
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
                  <p className="text-red-400 mb-4">Failed to load avatar</p>
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
              onClick={() => {
                stopSession();
                onManualDisconnect?.();
              }}
              className="absolute top-3 right-3 p-2 bg-red-500/80 hover:bg-red-500 rounded-full text-white transition-colors"
              title="Stop session"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}

          {/* Avatar toggle and voice buttons */}
          {state !== "disconnected" && state !== "connecting" && state !== "error" && (
            <div className="absolute bottom-3 left-3 flex gap-2">
              {/* Avatar toggle button */}
              <button
                onClick={switchAvatar}
                className="px-3 py-2 bg-white/90 hover:bg-white rounded-lg text-gray-700 text-sm font-medium shadow-md transition-colors flex items-center gap-2"
                title="Switch avatar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
                {avatarType === "female" ? "Male" : "Female"}
              </button>

              {/* Voice selection button */}
              <div className="relative" ref={voiceMenuRef}>
                <button
                  onClick={() => setShowVoiceMenu(!showVoiceMenu)}
                  className="px-3 py-2 bg-white/90 hover:bg-white rounded-lg text-gray-700 text-sm font-medium shadow-md transition-colors flex items-center gap-2"
                  title="Change voice"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
                    <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
                  </svg>
                  Voice
                </button>

                {/* Voice dropdown menu */}
                {showVoiceMenu && (
                  <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                    {(avatarType === "male" ? maleVoices : femaleVoices).map((voice) => (
                      <button
                        key={voice.id}
                        onClick={() => changeVoice(voice.id)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                          (avatarType === "male" ? maleVoice : femaleVoice) === voice.id
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        {voice.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* State indicator */}
        <div className={`mt-4 text-lg font-semibold ${stateColors[state]}`}>
          {stateLabels[state]}
        </div>

        {/* Medical disclaimer */}
        <p className="mt-2 text-xs text-gray-500 text-center max-w-md px-4">
          This AI assistant provides general health information only and is not a substitute for professional medical advice, diagnosis, or treatment.
        </p>
      </div>
    );
  }
);

export default TalkingHeadAvatar;
