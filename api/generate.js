export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    const { prompt } = req.body || {};

    if (!prompt || !prompt.trim()) {
        return res.status(400).json({
            error: "No app description was provided."
        });
    }

    return res.status(200).json({
        result:
            "FreeApp AI received your request successfully.\n\n" +
            "App request:\n" +
            prompt.trim() +
            "\n\n" +
            "AI generation engine is ready to be connected."
    });
}
