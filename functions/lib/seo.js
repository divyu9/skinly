"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSEOContent = void 0;
const https_1 = require("firebase-functions/v2/https");
const getOpenAIConfig = () => {
    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
        throw new Error("OpenAI API credentials not configured.");
    }
    return { apiKey };
};
exports.generateSEOContent = (0, https_1.onCall)({ memory: "256MiB", timeoutSeconds: 60 }, async (request) => {
    var _a, _b, _c;
    const data = request.data;
    // Ensure the user is an admin
    // if (!context.auth?.token?.admin) {
    //   throw new functions.https.HttpsError("permission-denied", "Unauthorized");
    // }
    const { prompt } = data;
    if (!prompt) {
        throw new Error("Missing prompt");
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