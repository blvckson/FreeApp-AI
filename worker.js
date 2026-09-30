const SYSTEM_PROMPT = `
You are FreeApp AI, a private personal software-building assistant.
Help the owner design, write, debug, and improve software.
Give practical implementation output. When code is requested, provide complete files or precise patches.
Do not claim that code was deployed, committed, tested, or executed unless the system actually did it.
`;

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/api/generate") {
            if (request.method !== "POST") {
                return json({ error: "Method not allowed." }, 405);
            }

            let body;
            try {
                body = await request.json();
            } catch {
                return json({ error: "Invalid JSON request." }, 400);
            }

            const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
            if (!prompt) {
                return json({ error: "Prompt is required." }, 400);
            }

            if (prompt.length > 12000) {
                return json({ error: "Prompt is too long." }, 400);
            }

            if (!env.AI) {
                return json({
                    error: "AI binding is not configured yet. The Worker is deployed, but the Cloudflare AI binding still needs to be connected."
                }, 503);
            }

            try {
                const response = await env.AI.run(
                    "@cf/meta/llama-3.1-8b-instruct-fast",
                    {
                        messages: [
                            { role: "system", content: SYSTEM_PROMPT },
                            { role: "user", content: prompt }
                        ],
                        max_tokens: 4096
                    }
                );

                return json({ result: response?.response || "The AI returned no text." });
            } catch (error) {
                return json({ error: "AI request failed.", detail: String(error?.message || error) }, 502);
            }
        }

        if (url.pathname === "/api/health") {
            return json({ ok: true, service: "FreeApp AI", aiConfigured: Boolean(env.AI) });
        }

        return env.ASSETS.fetch(request);
    }
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8" }
    });
}
