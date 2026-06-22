const RISK_PATTERNS: Record<string, string[]> = {
  cardiac_stroke: [
    "chest pain", "can't breathe", "cant breathe", "difficulty breathing",
    "shortness of breath", "left arm numb", "arm numb", "face drooping", "slurred speech",
  ],
  mental_health_crisis: [
    "suicide", "suicidal", "kill myself", "end my life", "want to die", "self harm", "self-harm",
  ],
  severe_acute: [
    "overdose", "anaphylaxis", "severe allergic", "unconscious", "passed out", "seizure",
  ],
};

export function detectRisk(query: string): string | null {
  const q = query.toLowerCase();
  for (const [category, terms] of Object.entries(RISK_PATTERNS)) {
    if (terms.some((t) => q.includes(t))) return category;
  }
  return null;
}
