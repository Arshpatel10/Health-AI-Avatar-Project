export type EmotionState = "neutral" | "supportive" | "warning" | "confused";

export interface EvidenceSource {
  document_id: string;
  chunk_id: string;
  title?: string;
  snippet?: string;
  url?: string;
}

export interface CoachResponse {
  answer: string;
  evidence_used: EvidenceSource[];
  guardrail_triggered: boolean;
  emotion_state: EmotionState;
}

export type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; response: CoachResponse };
