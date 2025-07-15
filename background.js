
async function getAiResponse(command, tab) {
    // Get the user's API key from storage
    const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
    if (!geminiApiKey) {
        return "Error: Gemini API key not found. Please set your key in the extension's options page.";
    }

    // Inject a script to get the text content of the current page
    const scriptResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText,
    });
    if (!scriptResult || !scriptResult[0] || !scriptResult[0].result) {
        throw new Error("Could not retrieve page content.");
    }
    const pageContent = scriptResult[0].result;

    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    const prompt = `Based on the following webpage content, please respond to this command: "${command}"\n\n--- WEBPAGE CONTENT ---\n${pageContent.substring(0, 30000)}`;

    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Gemini API Error:", errorData);
        throw new Error(`API request failed: ${errorData.error.message}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getAiResponse') {
        getAiResponse(request.command, sender.tab)
            .then(response => {
                sendResponse({ text: response });
            })
            .catch(error => {
                console.error("Error getting AI response:", error);
                sendResponse({ text: `Sorry, there was an error: ${error.message}` });
            });

        return true;
    }
});
