"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLLMProvider = createLLMProvider;
exports.hasLLMConfiguration = hasLLMConfiguration;
exports.getLLMConfigurationMissingKeys = getLLMConfigurationMissingKeys;
exports.requireLLMProvider = requireLLMProvider;
exports.chatWithLLM = chatWithLLM;
exports.getDeterministicPromptTemplate = getDeterministicPromptTemplate;
const azure_openai_1 = require("./azure-openai");
function createLLMProvider() {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
    if (!endpoint || !apiKey || !deployment) {
        return null;
    }
    return new azure_openai_1.AzureOpenAIProvider(endpoint, apiKey, deployment, apiVersion);
}
function hasLLMConfiguration() {
    return Boolean(process.env.AZURE_OPENAI_ENDPOINT &&
        process.env.AZURE_OPENAI_API_KEY &&
        process.env.AZURE_OPENAI_DEPLOYMENT);
}
function getLLMConfigurationMissingKeys() {
    const missing = [];
    if (!process.env.AZURE_OPENAI_ENDPOINT)
        missing.push('AZURE_OPENAI_ENDPOINT');
    if (!process.env.AZURE_OPENAI_API_KEY)
        missing.push('AZURE_OPENAI_API_KEY');
    if (!process.env.AZURE_OPENAI_DEPLOYMENT)
        missing.push('AZURE_OPENAI_DEPLOYMENT');
    return missing;
}
function requireLLMProvider() {
    const provider = createLLMProvider();
    if (!provider) {
        const missing = getLLMConfigurationMissingKeys();
        throw new Error(`LLM provider not configured. Missing env vars: ${missing.join(', ')}`);
    }
    return provider;
}
async function chatWithLLM(messages, tools, options) {
    const provider = requireLLMProvider();
    return provider.chat(messages, tools, options);
}
function getDeterministicPromptTemplate(allowedActions) {
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
//# sourceMappingURL=factory.js.map