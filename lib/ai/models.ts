export const DEFAULT_CHAT_MODEL = "llama-3.3-70b-versatile";

export const titleModel = {
  id: "llama-3.3-70b-versatile",
  name: "Llama 3.3 70B",
  provider: "groq",
  description: "Fast model for title generation",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export const chatModels: ChatModel[] = [
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B",
    provider: "groq",
    description: "Fast and capable general-purpose model",
  },
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B Instant",
    provider: "groq",
    description: "Ultra-fast lightweight model",
  },
  {
    id: "gemma2-9b-it",
    name: "Gemma 2 9B",
    provider: "groq",
    description: "Google's efficient instruction-tuned model",
  },
  {
    id: "mixtral-8x7b-32768",
    name: "Mixtral 8x7B",
    provider: "groq",
    description: "Mistral MoE model with 32k context",
  },
];

const staticCapabilities: Record<string, ModelCapabilities> = {
  "llama-3.3-70b-versatile": { tools: true, vision: false, reasoning: false },
  "llama-3.1-8b-instant": { tools: true, vision: false, reasoning: false },
  "gemma2-9b-it": { tools: true, vision: false, reasoning: false },
  "mixtral-8x7b-32768": { tools: true, vision: false, reasoning: false },
};

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  return staticCapabilities;
}

export const isDemo = process.env.IS_DEMO === "1";

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
