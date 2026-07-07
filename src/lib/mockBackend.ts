import { CoachResponse } from "./types";
import { detectRisk } from "./guardrails";

const SAFETY_MESSAGES: Record<string, string> = {
  cardiac_stroke:
    "Your symptoms may require urgent medical attention. Please contact emergency services (911) immediately.",
  severe_acute:
    "This could be a medical emergency. Please contact emergency services (911) or get to an emergency room right away.",
  mental_health_crisis:
    "It sounds like you may be going through something serious. Please reach out to a crisis line such as 988, or contact emergency services. You don't have to go through this alone.",
};

interface MockEntry {
  keywords: string[];
  response: CoachResponse;
}

const NORMAL_RESPONSES: MockEntry[] = [
  {
    keywords: ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening"],
    response: {
      answer:
        "Hello! I'm your AI Health Assistant. I can help answer general health questions about topics like sleep, hydration, cholesterol, and more. How can I help you today?",
      evidence_used: [],
      guardrail_triggered: false,
      emotion_state: "supportive",
    },
  },
  {
    keywords: ["thank", "thanks", "appreciate"],
    response: {
      answer:
        "You're welcome! I'm happy to help. Is there anything else you'd like to know about your health?",
      evidence_used: [],
      guardrail_triggered: false,
      emotion_state: "supportive",
    },
  },
  {
    keywords: ["cholesterol", "ldl", "fiber"],
    response: {
      answer:
        "Soluble fiber from foods like oats, beans, and apples can help lower LDL cholesterol. This is general educational information; please discuss treatment options with your clinician.",
      evidence_used: [
        { document_id: "doc_1", chunk_id: "chunk_2", title: "Dietary Fiber and Cardiovascular Health", snippet: "Soluble fiber binds bile acids, which can reduce circulating LDL cholesterol.", url: "https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/nutrition-basics/dietary-fiber" },
      ],
      guardrail_triggered: false,
      emotion_state: "supportive",
    },
  },
  {
    keywords: ["water", "hydration", "hydrate", "drink"],
    response: {
      answer:
        "General guidance suggests roughly 2 to 3 liters of total water per day for most adults, including water from food. Your needs vary with activity, climate, and health conditions.",
      evidence_used: [
        { document_id: "doc_2", chunk_id: "chunk_1", title: "Hydration Guidelines for Adults", snippet: "Total daily water intake includes fluids from beverages and food; needs vary.", url: "https://www.mayoclinic.org/healthy-lifestyle/nutrition-and-healthy-eating/in-depth/water/art-20044256" },
      ],
      guardrail_triggered: false,
      emotion_state: "neutral",
    },
  },
  {
    keywords: ["sleep", "insomnia", "tired", "rest"],
    response: {
      answer:
        "Most adults do best with 7 to 9 hours of sleep per night. A consistent schedule and limiting screens before bed can help. If poor sleep persists, it's worth discussing with your clinician.",
      evidence_used: [
        { document_id: "doc_3", chunk_id: "chunk_4", title: "Sleep Duration Recommendations", snippet: "Adults are generally advised to get 7 to 9 hours of sleep for optimal health.", url: "https://www.cdc.gov/sleep/about_sleep/how_much_sleep.html" },
      ],
      guardrail_triggered: false,
      emotion_state: "supportive",
    },
  },
];

const DEFAULT_RESPONSE: CoachResponse = {
  answer:
    "I'm not quite sure about that specific question. This is general educational information, so please discuss it with your clinician for advice tailored to you.",
  evidence_used: [],
  guardrail_triggered: false,
  emotion_state: "confused",
};

function matchNormalResponse(query: string): CoachResponse {
  const q = query.toLowerCase();
  const match = NORMAL_RESPONSES.find((e) => e.keywords.some((k) => q.includes(k)));
  return match ? match.response : DEFAULT_RESPONSE;
}

export async function getCoachResponse(query: string): Promise<CoachResponse> {
  await new Promise((r) => setTimeout(r, 1200)); // simulated latency -> drives the loading state

  const risk = detectRisk(query);
  if (risk) {
    return {
      answer: SAFETY_MESSAGES[risk] ?? SAFETY_MESSAGES.cardiac_stroke,
      evidence_used: [],
      guardrail_triggered: true,
      emotion_state: "warning",
    };
  }
  return matchNormalResponse(query);
}
