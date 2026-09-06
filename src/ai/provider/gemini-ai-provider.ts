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
        const errorText = await response.text().catch(() => '');
        // Sanitize errorText so credentials/headers cannot leak
        const sanitizedSnippet = errorText ? errorText.slice(0, 500) : '';
        throw new AIProviderError(`Gemini API error: HTTP ${response.status} ${response.statusText}${sanitizedSnippet ? ` - ${sanitizedSnippet}` : ''}`);
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
      const message = err instanceof Error ? err.message : String(err);
      throw new AIProviderError(`Failed to call Gemini provider: ${message}`, err);
    }
  }
}