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
  model: string = 'llama3-8b-8192'
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
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to fetch from Groq');
  }

  return response.json();
};