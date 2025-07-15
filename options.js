
document.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.getElementById('save');
    const apiKeyInput = document.getElementById('apiKey');
    const statusEl = document.getElementById('status');

    chrome.storage.sync.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
    });

    saveButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
                statusEl.textContent = '✅ Saved!';
                statusEl.className = 'ml-4 text-sm font-medium text-green-600';
                setTimeout(() => {
                    statusEl.textContent = '';
                }, 2000);
            });
        }
    });
});
