import { Message, GroqResponse } from '../types';

export const checkGroqStatus = async (apiKey: string): Promise<boolean> => {
  if (!apiKey) return false;
  try {
    // Making a lightweight call to check validity
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

export const chatWithGroq = async (
  messages: Message[],
  apiKey: string,
  model: string = 'llama-3.3-70b-versatile'
): Promise<GroqResponse> => {
  if (!apiKey) throw new Error("API Key is missing");

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages,
      model,
      temperature: 0.7,
      max_tokens: 1024,
      stream: false
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    // Check for Rate Limit specifically
    if (response.status === 429) {
      throw new Error('GROQ_RATE_LIMIT_EXCEEDED');
    }

    throw new Error(errorData.error?.message || `API Error: ${response.statusText}`);
  }

  return response.json();
};