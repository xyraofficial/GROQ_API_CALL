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
  'llama3-8b-8192',
  'llama3-70b-8192',
  'mixtral-8x7b-32768',
  'gemma-7b-it'
];