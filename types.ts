export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: Message;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ApiStatusMetric {
  endpoint: string;
  method: string;
  status: 'Operational' | 'Degraded' | 'Down';
  latency: number;
  lastChecked: string;
}

export enum AppView {
  CHAT = 'CHAT',
  API_INFO = 'API_INFO',
  SETTINGS = 'SETTINGS'
}

export const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant'
];