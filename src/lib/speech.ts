import { AvatarState } from "@/components/Avatar";

export type VoiceOption = "voice1" | "voice2" | "voice3" | "voice4" | "voice5" | "voice6";

export interface VoiceInfo {
  id: VoiceOption;
  name: string;
  description: string;
}

interface SpeechSettings {
  rate: number;
  pitch: number;
  volume: number;
}

// Different tone settings for each avatar state
const stateToneSettings: Record<AvatarState, SpeechSettings> = {
  idle: { rate: 1.0, pitch: 1.0, volume: 1.0 },
  listening: { rate: 1.0, pitch: 1.0, volume: 1.0 },
  thinking: { rate: 1.0, pitch: 1.0, volume: 1.0 },
  speaking: { rate: 1.0, pitch: 1.0, volume: 1.0 },
  supportive: { rate: 0.95, pitch: 1.1, volume: 0.9 }, // Warmer, softer tone
  warning: { rate: 0.85, pitch: 0.85, volume: 1.0 }, // Slower, deeper, more serious
  confused: { rate: 0.9, pitch: 1.05, volume: 0.95 }, // Slightly uncertain tone
};

class SpeechService {
  private synthesis: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoice: VoiceOption = "voice1";
  private isInitialized = false;
  private onSpeakingChange?: (isSpeaking: boolean) => void;

  constructor() {
    if (typeof window !== "undefined") {
      this.synthesis = window.speechSynthesis;
      this.loadVoices();

      // Voices may load asynchronously
      if (this.synthesis) {
        this.synthesis.onvoiceschanged = () => {
          this.loadVoices();
        };
      }
    }
  }

  private loadVoices() {
    if (this.synthesis) {
      this.voices = this.synthesis.getVoices();
      this.isInitialized = this.voices.length > 0;
    }
  }

  setOnSpeakingChange(callback: (isSpeaking: boolean) => void) {
    this.onSpeakingChange = callback;
  }

  setVoiceOption(voice: VoiceOption) {
    this.selectedVoice = voice;
  }

  getVoiceOption(): VoiceOption {
    return this.selectedVoice;
  }

  private getVoiceForOption(voiceOption: VoiceOption): SpeechSynthesisVoice | null {
    if (!this.voices.length) {
      this.loadVoices();
    }

    const englishVoices = this.voices.filter(v => v.lang.startsWith("en"));

    // Voice preferences for each option - targeting different voice styles
    const voicePreferences: Record<VoiceOption, string[]> = {
      // Warm, friendly female voice
      voice1: ["Samantha", "Karen", "Tessa", "Google US English Female", "Microsoft Zira"],
      // Professional male voice
      voice2: ["Daniel", "Alex", "Google US English Male", "Microsoft David"],
      // British English female
      voice3: ["Kate", "Serena", "Moira", "Google UK English Female", "Martha"],
      // British English male
      voice4: ["Oliver", "Arthur", "Thomas", "Google UK English Male", "Malcolm"],
      // Australian/Irish accent
      voice5: ["Fiona", "Lee", "Tessa", "Catherine", "Rishi"],
      // Calm, soothing voice
      voice6: ["Victoria", "Ava", "Allison", "Susan", "Veena"]
    };

    const preferredNames = voicePreferences[voiceOption] || voicePreferences.voice1;

    // Try to find a preferred voice
    for (const name of preferredNames) {
      const foundVoice = this.voices.find(v => v.name.includes(name));
      if (foundVoice) return foundVoice;
    }

    // Fallback: use index-based selection from available English voices
    const voiceIndex = parseInt(voiceOption.replace("voice", "")) - 1;
    if (englishVoices[voiceIndex]) {
      return englishVoices[voiceIndex];
    }

    // Last fallback: return first English voice or any voice
    return englishVoices[0] || this.voices[0] || null;
  }

  // Get info about available voice options
  getVoiceOptions(): VoiceInfo[] {
    return [
      { id: "voice1", name: "Voice 1", description: "Warm & friendly" },
      { id: "voice2", name: "Voice 2", description: "Professional" },
      { id: "voice3", name: "Voice 3", description: "British female" },
      { id: "voice4", name: "Voice 4", description: "British male" },
      { id: "voice5", name: "Voice 5", description: "International" },
      { id: "voice6", name: "Voice 6", description: "Calm & soothing" }
    ];
  }

  // Get the actual system voice name being used for an option
  getActualVoiceName(voiceOption: VoiceOption): string {
    const voice = this.getVoiceForOption(voiceOption);
    return voice?.name || "Default";
  }

  speak(text: string, state: AvatarState = "speaking"): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error("Speech synthesis not available"));
        return;
      }

      // Cancel any ongoing speech
      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      // Get voice based on selected option
      const voice = this.getVoiceForOption(this.selectedVoice);
      if (voice) {
        utterance.voice = voice;
      }

      // Apply tone settings based on state
      const toneSettings = stateToneSettings[state] || stateToneSettings.speaking;
      utterance.rate = toneSettings.rate;
      utterance.pitch = toneSettings.pitch;
      utterance.volume = toneSettings.volume;

      utterance.onstart = () => {
        this.onSpeakingChange?.(true);
      };

      utterance.onend = () => {
        this.onSpeakingChange?.(false);
        resolve();
      };

      utterance.onerror = (event) => {
        this.onSpeakingChange?.(false);
        reject(event.error);
      };

      this.synthesis.speak(utterance);
    });
  }

  stop() {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.onSpeakingChange?.(false);
    }
  }

  isSpeaking(): boolean {
    return this.synthesis?.speaking || false;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }
}

// Singleton instance
let speechService: SpeechService | null = null;

export function getSpeechService(): SpeechService {
  if (!speechService) {
    speechService = new SpeechService();
  }
  return speechService;
}
