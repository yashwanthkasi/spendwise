import Groq from 'groq-sdk';

let cached: Groq | null = null;

export function getGroq(): Groq | null {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key) return null;
  if (!cached) {
    cached = new Groq({ apiKey: key, dangerouslyAllowBrowser: true });
  }
  return cached;
}

export function getGroqModel(): string {
  return import.meta.env.VITE_GROQ_MODEL ?? 'llama-3.3-70b-versatile';
}
