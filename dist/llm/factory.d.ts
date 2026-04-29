import { LLMProvider } from './provider';
export declare function createLLMProvider(): LLMProvider | null;
export declare function hasLLMConfiguration(): boolean;
export declare function getLLMConfigurationMissingKeys(): string[];
export declare function requireLLMProvider(): LLMProvider;
export declare function chatWithLLM(messages: any[], tools?: any[], options?: any): Promise<any>;
export declare function getDeterministicPromptTemplate(allowedActions: string[]): string;
//# sourceMappingURL=factory.d.ts.map