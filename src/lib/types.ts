export type EmotionState = "supportive" | "warning";

export type SufficiencyReason =
  | "sufficient"
  | "low_similarity"
  | "insufficient_direct_support"
  | "out_of_scope"
  | "personalized_medical_advice"
  | "pediatric_care_not_supported"
  | "symptom_assessment_not_supported"
  | "urgent_symptom_escalation";

export interface EvidenceItem {
  document_id: string;
  chunk_id: string;
  similarity_score: number;
}

export interface CoachResponse {
  answer: string;
  evidence_used: EvidenceItem[];
  evidence_sufficient: boolean;
  sufficiency_reason: SufficiencyReason;
  guardrail_triggered: boolean;
  emotion_state: EmotionState;
}

export type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; response: CoachResponse };
