"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureOpenAIProvider = void 0;
class AzureOpenAIProvider {
    constructor(endpoint, apiKey, deployment, apiVersion) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
        this.deployment = deployment;
        this.name = 'azure-openai';
        this.apiVersion = apiVersion || process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
    }
    async chat(messages, tools, options) {
        const base = this.endpoint.replace(/\/$/, '');
        const url = `${base}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
        const payload = {
            messages,
            temperature: options?.temperature ?? 0,
            max_tokens: options?.maxTokens ?? 800,
        };
        if (tools && Array.isArray(tools) && tools.length > 0) {
            payload.tools = tools;
        }
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': this.apiKey,
            },
            body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) {
            throw new Error(`Azure OpenAI request failed (${res.status}): ${JSON.stringify(body)}`);
        }
        const content = body?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') {
            throw new Error('Azure OpenAI response missing message content');
        }
        return { content, raw: body };
    }
}
exports.AzureOpenAIProvider = AzureOpenAIProvider;
//# sourceMappingURL=azure-openai.js.map