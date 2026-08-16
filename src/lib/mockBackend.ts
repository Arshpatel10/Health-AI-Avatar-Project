import { CoachResponse, SufficiencyReason } from "./types";
import { detectRisk } from "./guardrails";

const SAFETY_MESSAGES: Record<string, { answer: string; reason: SufficiencyReason }> = {
  cardiac_stroke: {
    answer: "Your message mentions symptoms that can be a medical emergency. Call your local emergency number, such as 911, or seek emergency care now.",
    reason: "urgent_symptom_escalation",
  },
  severe_acute: {
    answer: "This could be a medical emergency. Please contact emergency services (911) or get to an emergency room right away.",
    reason: "urgent_symptom_escalation",
  },
  mental_health_crisis: {
    answer: "It sounds like you may be going through something serious. Please reach out to a crisis line such as 988, or contact emergency services. You don't have to go through this alone.",
    reason: "urgent_symptom_escalation",
  },
};

interface MockEntry {
  keywords: string[];
  response: Omit<CoachResponse, "emotion_state">;
}

const NORMAL_RESPONSES: MockEntry[] = [
  {
    keywords: ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening"],
    response: {
      answer:
        "Hello! I'm your AI Health Assistant. I can help answer general health questions about topics like sleep, hydration, cholesterol, and more. How can I help you today?",
      evidence_used: [],
      evidence_sufficient: true,
      sufficiency_reason: "sufficient",
      guardrail_triggered: false,
    },
  },
  {
    keywords: ["thank", "thanks", "appreciate"],
    response: {
      answer:
        "You're welcome! I'm happy to help. Is there anything else you'd like to know about your health?",
      evidence_used: [],
      evidence_sufficient: true,
      sufficiency_reason: "sufficient",
      guardrail_triggered: false,
    },
  },
  {
    keywords: ["cholesterol", "ldl", "fiber"],
    response: {
      answer:
        "Soluble fiber from foods like oats, beans, and apples can help lower LDL cholesterol [lit_doc_001/chunk_2]. This is general educational information; please discuss treatment options with your clinician.",
      evidence_used: [
        { document_id: "lit_doc_001", chunk_id: "chunk_2", similarity_score: 0.72 },
      ],
      evidence_sufficient: true,
      sufficiency_reason: "sufficient",
      guardrail_triggered: false,
    },
  },
  {
    keywords: ["water", "hydration", "hydrate", "drink"],
    response: {
      answer:
        "General guidance suggests roughly 2 to 3 liters of total water per day for most adults, including water from food [lit_doc_002/chunk_1]. Your needs vary with activity, climate, and health conditions.",
      evidence_used: [
        { document_id: "lit_doc_002", chunk_id: "chunk_1", similarity_score: 0.68 },
      ],
      evidence_sufficient: true,
      sufficiency_reason: "sufficient",
      guardrail_triggered: false,
    },
  },
  {
    keywords: ["sleep", "insomnia", "tired", "rest"],
    response: {
      answer:
        "Most adults do best with 7 to 9 hours of sleep per night [lit_doc_003/chunk_4]. A consistent schedule and limiting screens before bed can help. If poor sleep persists, it's worth discussing with your clinician.",
      evidence_used: [
        { document_id: "lit_doc_003", chunk_id: "chunk_4", similarity_score: 0.75 },
      ],
      evidence_sufficient: true,
      sufficiency_reason: "sufficient",
      guardrail_triggered: false,
    },
  },
  {
    keywords: ["hfpef", "heart failure preserved", "preserved ejection"],
    response: {
      answer:
        "HFpEF is a type of heart failure in which the heart's pumping measurement is preserved, but the heart still has difficulty filling or working normally [lit_doc_119/chunk_2ba4a2ddc33d].",
      evidence_used: [
        { document_id: "lit_doc_119", chunk_id: "chunk_2ba4a2ddc33d", similarity_score: 0.82 },
      ],
      evidence_sufficient: true,
      sufficiency_reason: "sufficient",
      guardrail_triggered: false,
    },
  },
];

const DEFAULT_RESPONSE: Omit<CoachResponse, "emotion_state"> = {
  answer:
    "I don't have enough information in my reference documents to answer that reliably, so I'd rather not guess.",
  evidence_used: [],
  evidence_sufficient: false,
  sufficiency_reason: "low_similarity",
  guardrail_triggered: false,
};

function matchNormalResponse(query: string): Omit<CoachResponse, "emotion_state"> {
  const q = query.toLowerCase();
  const match = NORMAL_RESPONSES.find((e) => e.keywords.some((k) => q.includes(k)));
  return match ? match.response : DEFAULT_RESPONSE;
}

export async function getCoachResponse(query: string): Promise<CoachResponse> {
  await new Promise((r) => setTimeout(r, 1200)); // simulated latency -> drives the loading state

  const risk = detectRisk(query);
  if (risk) {
    const safetyMsg = SAFETY_MESSAGES[risk] ?? SAFETY_MESSAGES.cardiac_stroke;
    return {
      answer: safetyMsg.answer,
      evidence_used: [],
      evidence_sufficient: false,
      sufficiency_reason: safetyMsg.reason,
      guardrail_triggered: true,
      emotion_state: "warning", // guardrail_triggered === true → warning
    };
  }

  const response = matchNormalResponse(query);
  return {
    ...response,
    emotion_state: "supportive", // guardrail_triggered === false → supportive
  };
}
