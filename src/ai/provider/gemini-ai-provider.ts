import type { AIProvider } from './ai-provider';
import {
  AIProviderError,
  type GenerationRequest
} from '../schema/types';

export interface GeminiProviderConfig {
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

export const GEMINI_QUESTIONS_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          stem: { type: 'STRING' },
          type: {
            type: 'STRING',
            enum: ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTI_SELECT']
          },
          options: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          },
          correctOptionIndices: {
            type: 'ARRAY',
            items: { type: 'INTEGER' }
          },
          explanation: { type: 'STRING' },
          scriptureReference: { type: 'STRING' },
          topic: { type: 'STRING' },
          difficulty: {
            type: 'STRING',
            enum: ['Easy', 'Medium', 'Hard']
          },
          language: { type: 'STRING' }
        },
        required: [
          'stem',
          'type',
          'options',
          'correctOptionIndices',
          'explanation',
          'scriptureReference',
          'topic',
          'difficulty',
          'language'
        ]
      }
    }
  },
  required: ['questions']
};

function sanitizeMessage(text: string, secrets: string[]): string {
  let cleaned = text;
  for (const secret of secrets) {
    if (secret && secret.length > 3) {
      cleaned = cleaned.split(secret).join('[REDACTED]');
    }
  }
  // Strip any authorization headers or api key query parameters
  cleaned = cleaned.replace(/x-goog-api-key:[^\s,]+/gi, 'x-goog-api-key:[REDACTED]');
  cleaned = cleaned.replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]');
  cleaned = cleaned.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
  return cleaned;
}

export class GeminiAIProvider implements AIProvider {
  public readonly name = 'gemini-ai-provider';
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly endpoint: string;

  constructor(config: GeminiProviderConfig = {}) {
    this.apiKey = config.apiKey || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined);
    this.model = config.model || (typeof process !== 'undefined' ? process.env?.GEMINI_MODEL : undefined) || 'gemini-2.5-flash';
    this.endpoint = config.endpoint || 'https://generativelanguage.googleapis.com/v1beta';
  }

  private extractSafeErrorMessage(rawText: string): string {
    const secrets = this.apiKey ? [this.apiKey] : [];
    if (!rawText.trim()) return '';

    try {
      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        const errorObj = parsed.error as Record<string, unknown> | undefined;
        if (errorObj && typeof errorObj === 'object') {
          const msg = typeof errorObj.message === 'string' ? errorObj.message.trim() : '';
          const status = typeof errorObj.status === 'string' ? errorObj.status.trim() : '';
          const combined = [status, msg].filter(Boolean).join(': ');
          if (combined) {
            return sanitizeMessage(combined.slice(0, 200), secrets);
          }
        }
      }
    } catch {
      // Not JSON, extract safe single line
      const firstLine = rawText.split('\n')[0].trim();
      if (firstLine) {
        return sanitizeMessage(firstLine.slice(0, 200), secrets);
      }
    }

    return '';
  }

  async generateRaw(request: GenerationRequest): Promise<unknown> {
    if (!this.apiKey) {
      throw new AIProviderError(
        'Gemini API key is not configured. Set the GEMINI_API_KEY environment variable or pass apiKey in GeminiProviderConfig.'
      );
    }

    const url = `${this.endpoint}/models/${encodeURIComponent(this.model)}:generateContent`;

    const promptText = [
      `You are an assistant generating biblical quiz questions for church education.`,
      `Topic: ${request.topic}`,
      request.passageReference ? `Passage: ${request.passageReference}` : '',
      `Question count: ${request.count}`,
      `Difficulty: ${request.difficulty}`,
      request.type ? `Question Type: ${request.type}` : '',
      `Language: ${request.language}`,
      request.teacherInstructions ? `Teacher Instructions: ${request.teacherInstructions}` : '',
      `Output must strictly be valid JSON matching the schema with a root object containing a 'questions' array.`
    ].filter(Boolean).join('\n');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: promptText }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: GEMINI_QUESTIONS_RESPONSE_SCHEMA
          }
        })
      });

      if (!response.ok) {
        const rawBody = await response.text().catch(() => '');
        const safeDetail = this.extractSafeErrorMessage(rawBody);
        throw new AIProviderError(
          `Gemini API error: HTTP ${response.status} ${response.statusText}${safeDetail ? ` - ${safeDetail}` : ''}`
        );
      }

      const data = await response.json() as Record<string, unknown>;
      const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
      const rawText = candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new AIProviderError('Gemini API returned an empty or missing response content part.');
      }

      return JSON.parse(rawText);
    } catch (err: unknown) {
      if (err instanceof AIProviderError) {
        throw err;
      }
      const rawMessage = err instanceof Error ? err.message : String(err);
      const sanitized = sanitizeMessage(rawMessage, this.apiKey ? [this.apiKey] : []);
      throw new AIProviderError(`Failed to call Gemini provider: ${sanitized}`, err);
    }
  }
}