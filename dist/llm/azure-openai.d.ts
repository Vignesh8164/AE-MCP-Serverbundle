import { LLMProvider, ChatMessage, ChatOptions, ChatResult } from './provider';
export declare class AzureOpenAIProvider implements LLMProvider {
    private endpoint;
    private apiKey;
    private deployment;
    name: string;
    private apiVersion;
    constructor(endpoint: string, apiKey: string, deployment: string, apiVersion?: string);
    chat(messages: ChatMessage[], tools?: any[], options?: ChatOptions): Promise<ChatResult>;
}
//# sourceMappingURL=azure-openai.d.ts.map