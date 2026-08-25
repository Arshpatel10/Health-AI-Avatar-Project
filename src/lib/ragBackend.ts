import { CoachResponse, EvidenceItem, SufficiencyReason } from "./types";

interface RagResponse {
  request_id: string;
  answer_status: "full" | "partial" | "refused" | "safety";
  answer: string;
  evidence_used: EvidenceItem[];
  evidence_sufficient: boolean;
  sufficiency_reason: SufficiencyReason;
  guardrail_triggered: boolean;
}

export async function getCoachResponse(question: string): Promise<CoachResponse> {
  const response = await fetch("/api/rag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.detail || "The evidence service is unavailable");
  }

  const rag = body as RagResponse;
  return {
    ...rag,
    emotion_state: rag.guardrail_triggered ? "warning" : "supportive",
  };
}

export function backendErrorResponse(error: unknown): CoachResponse {
  const detail = error instanceof Error ? error.message : "Unknown connection error";
  return {
    answer: `I could not reach the evidence service. Please try again after the backend connection is restored. (${detail})`,
    evidence_used: [],
    evidence_sufficient: false,
    sufficiency_reason: "insufficient_direct_support",
    guardrail_triggered: false,
    answer_status: "refused",
    emotion_state: "supportive",
  };
}
