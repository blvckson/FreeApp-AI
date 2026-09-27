const promptBox = document.getElementById("prompt");
const resultBox = document.getElementById("result");
const buildButton = document.querySelector("button");

buildButton.addEventListener("click", buildProject);

async function buildProject() {
    const prompt = promptBox.value.trim();

    if (!prompt) {
        resultBox.textContent = "Describe the app you want to build first.";
        return;
    }

    buildButton.disabled = true;
    buildButton.textContent = "Planning...";

    resultBox.textContent =
        "FreeApp AI is analyzing your request...\n\n" +
        "Request:\n" +
        prompt +
        "\n\n" +
        "Project planning started.";

    try {
        const response = await fetch("/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: prompt
            })
        });

        if (!response.ok) {
            throw new Error("AI service is not connected yet.");
        }

        const data = await response.json();

        resultBox.textContent =
            data.result || "The AI returned no result.";
    } catch (error) {
        resultBox.textContent =
            "AI engine is not connected yet.\n\n" +
            "Your request has been received successfully.\n\n" +
            "Next we will connect the actual AI code-generation engine.";
    }

    buildButton.disabled = false;
    buildButton.textContent = "Build App";
}
