export interface LLMProvider {
    name: string;
    chat(messages: any[], tools?: any[]): Promise<any>;
}
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
}
//# sourceMappingURL=provider.d.ts.map