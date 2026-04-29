export interface LLMProvider {
    name: string;
    chat(messages: ChatMessage[], tools?: any[], options?: ChatOptions): Promise<ChatResult>;
}
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
    name?: string;
}
export interface ChatOptions {
    temperature?: number;
    maxTokens?: number;
}
export interface ChatResult {
    content: string;
    raw?: any;
}
//# sourceMappingURL=provider.d.ts.map