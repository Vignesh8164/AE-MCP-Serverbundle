import { LLMProvider, ChatMessage } from './provider';
export declare class AzureOpenAIProvider implements LLMProvider {
    private endpoint;
    private apiKey;
    private deployment;
    name: string;
    constructor(endpoint: string, apiKey: string, deployment: string);
    chat(messages: ChatMessage[], tools?: any[]): Promise<any>;
}
//# sourceMappingURL=azure-openai.d.ts.map