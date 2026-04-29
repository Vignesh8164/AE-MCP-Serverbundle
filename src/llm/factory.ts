import { LLMProvider } from './provider';
import { AzureOpenAIProvider } from './azure-openai';

export function createLLMProvider(): LLMProvider | null {
  // Return null for now (no LLM). Later change this to return Azure provider.
  return null;
}
