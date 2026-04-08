"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSEOContent = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("./auth");
const rate_limit_1 = require("./rate-limit");
const getOpenAIConfig = () => {
    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
        throw new Error("OpenAI API credentials not configured.");
    }
    return { apiKey };
};
exports.generateSEOContent = (0, https_1.onCall)({ memory: "256MiB", timeoutSeconds: 60 }, async (request) => {
    var _a, _b, _c;
    const { uid } = await (0, auth_1.requireAdmin)(request);
    await (0, rate_limit_1.enforceDailyRateLimit)({ key: `generateSEOContent_${uid}`, limit: Number(process.env.SEO_DAILY_LIMIT || 100) });
    const data = request.data;
    const { prompt } = data;
    if (!prompt) {
        throw new Error("Missing prompt");
    }
    if (typeof prompt !== "string" || prompt.length > Number(process.env.SEO_PROMPT_MAX_CHARS || 6000)) {
        throw new Error("Invalid prompt");
    }
    const config = getOpenAIConfig();
    try {
        const fetch = require("node-fetch");
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert SEO content generator for a mobile skin and accessories e-commerce brand called Skinly."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
            })
        });
        if (!response.ok) {
            const errorData = await response.text();
            console.error("OpenAI API Error:", errorData);
            throw new Error("OpenAI API request failed");
        }
        const responseData = await response.json();
        const content = ((_c = (_b = (_a = responseData.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || "";
        return { success: true, content };
    }
    catch (error) {
        console.error("SEO Generation Error:", error);
        throw new Error(error.message || "SEO generation failed");
    }
});
//# sourceMappingURL=seo.js.map