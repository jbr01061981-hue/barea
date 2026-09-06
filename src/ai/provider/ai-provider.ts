import type { GenerationRequest } from '../schema/types';

export interface AIProvider {
  readonly name: string;
  generateRaw(request: GenerationRequest): Promise<unknown>;
}