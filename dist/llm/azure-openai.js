"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureOpenAIProvider = void 0;
class AzureOpenAIProvider {
    constructor(endpoint, apiKey, deployment) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
        this.deployment = deployment;
        this.name = 'azure-openai';
    }
    async chat(messages, tools) {
        // TODO: Implement Azure OpenAI call here later
        console.log('[Azure OpenAI] Would call model with messages:', messages);
        return { content: "Azure OpenAI not yet implemented. Coming soon!" };
    }
}
exports.AzureOpenAIProvider = AzureOpenAIProvider;
//# sourceMappingURL=azure-openai.js.map