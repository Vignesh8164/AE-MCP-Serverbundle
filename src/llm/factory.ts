import { LLMProvider } from './provider';
import { AzureOpenAIProvider } from './azure-openai';

export function createLLMProvider(): LLMProvider | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

  if (!endpoint || !apiKey || !deployment) {
    return null;
  }

  return new AzureOpenAIProvider(endpoint, apiKey, deployment, apiVersion);
}

export function hasLLMConfiguration(): boolean {
  return Boolean(
    process.env.AZURE_OPENAI_ENDPOINT &&
    process.env.AZURE_OPENAI_API_KEY &&
    process.env.AZURE_OPENAI_DEPLOYMENT
  );
}

export function getLLMConfigurationMissingKeys(): string[] {
  const missing: string[] = [];
  if (!process.env.AZURE_OPENAI_ENDPOINT) missing.push('AZURE_OPENAI_ENDPOINT');
  if (!process.env.AZURE_OPENAI_API_KEY) missing.push('AZURE_OPENAI_API_KEY');
  if (!process.env.AZURE_OPENAI_DEPLOYMENT) missing.push('AZURE_OPENAI_DEPLOYMENT');
  return missing;
}

export function requireLLMProvider(): LLMProvider {
  const provider = createLLMProvider();
  if (!provider) {
    const missing = getLLMConfigurationMissingKeys();
    throw new Error(`LLM provider not configured. Missing env vars: ${missing.join(', ')}`);
  }
  return provider;
}

export async function chatWithLLM(messages: any[], tools?: any[], options?: any): Promise<any> {
  const provider = requireLLMProvider();
  return provider.chat(messages, tools, options);
}

export function getDeterministicPromptTemplate(allowedActions: string[]): string {
  return [
    'You are a deterministic command planner for Adobe After Effects.',
    'Return ONLY strict JSON and no prose.',
    'Output format:',
    '{',
    '  \"commands\": [',
    '    { \"action\": \"<allowed action>\", \"params\": { } }',
    '  ]',
    '}',
    'Rules:',
    '- Emit at least one command.',
    '- Use only actions in allowed list.',
    '- Keep params minimal but executable.',
    `Allowed actions: ${allowedActions.join(', ')}`,
  ].join('\\n');
}
