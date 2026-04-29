import { LLMProvider, ChatMessage } from './provider';

export class AzureOpenAIProvider implements LLMProvider {
  name = 'azure-openai';

  constructor(private endpoint: string, private apiKey: string, private deployment: string) {}

  async chat(messages: ChatMessage[], tools?: any[]): Promise<any> {
    // TODO: Implement Azure OpenAI call here later
    console.log('[Azure OpenAI] Would call model with messages:', messages);
    return { content: "Azure OpenAI not yet implemented. Coming soon!" };
  }
}
