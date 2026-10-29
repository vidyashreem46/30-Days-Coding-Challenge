
const form = document.getElementById("generatorForm");
const lengthInput = document.getElementById("length");
const lengthValue = document.getElementById("lengthValue");
const generateBtn = document.getElementById("generateBtn");
const regenerateBtn = document.getElementById("regenerateBtn");
const message = document.getElementById("message");

const resultsSection = document.getElementById("resultsSection");
const passwordList = document.getElementById("passwordList");

const historySection = document.getElementById("historySection");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

const strengthLabel = document.getElementById("strengthLabel");
const strengthBar = document.getElementById("strengthBar");
const strengthTrack = document.getElementById("strengthTrack");
const entropyText = document.getElementById("entropyText");

const DEFAULT_SYMBOLS = "!@#$%^&*()-_=+?";
const MAX_HISTORY = 20;
const passwordHistory = [];

lengthInput.addEventListener("input", () => {
    lengthValue.textContent = lengthInput.value;
});

form.addEventListener("submit", (event) => {
    event.preventDefault();
    generatePasswords();
});

regenerateBtn.addEventListener("click", generatePasswords);

clearHistoryBtn.addEventListener("click", () => {
    passwordHistory.length = 0;
    displayHistory();
});

function readSettings() {
    return {
        length: Number(lengthInput.value),
        count: Number(document.getElementById("count").value),
        use_upper: document.getElementById("use_upper").checked,
        use_lower: document.getElementById("use_lower").checked,
        use_digits: document.getElementById("use_digits").checked,
        use_symbols: document.getElementById("use_symbols").checked,
        exclude_confusing:
            document.getElementById("exclude_confusing").checked
    };
}

async function generatePasswords() {
    message.textContent = "";

    const settings = readSettings();

    const selectedTypes = [
        settings.use_upper,
        settings.use_lower,
        settings.use_digits,
        settings.use_symbols
    ].filter(Boolean).length;

    if (selectedTypes === 0) {
        message.textContent =
            "Please select at least one character type.";
        return;
    }

    if (settings.length < selectedTypes) {
        message.textContent =
            "Choose a longer password for the selected character types.";
        return;
    }

    generateBtn.disabled = true;
    regenerateBtn.disabled = true;
    generateBtn.textContent = "Generating...";

    try {
        const response = await fetch("/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(settings)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Password generation failed.");
        }

        if (!Array.isArray(result.passwords)) {
            throw new Error("The server returned an unexpected response.");
        }

        displayPasswords(result.passwords);
        updateStrength(settings);

        resultsSection.hidden = false;

        // Keep only the most recent passwords in page memory.
        passwordHistory.unshift(...result.passwords);
        passwordHistory.splice(MAX_HISTORY);

        displayHistory();
    } catch (error) {
        message.textContent =
            error.message || "Something went wrong. Please try again.";
    } finally {
        generateBtn.disabled = false;
        regenerateBtn.disabled = false;
        generateBtn.textContent = "✳ Generate passwords →";
    }
}

function displayPasswords(passwords) {
    passwordList.replaceChildren();

    passwords.forEach((password, index) => {
        const item = document.createElement("div");
        item.className = "password-item";

        const passwordText = document.createElement("span");
        passwordText.className = "password-text";
        passwordText.textContent = `${index + 1}. ${password}`;

        const copyButton = makeCopyButton(password);

        item.append(passwordText, copyButton);
        passwordList.appendChild(item);
    });
}

function makeCopyButton(password) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "copy-btn";
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy password");

    button.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(password);

            button.textContent = "Copied!";
            button.setAttribute("aria-label", "Password copied");

            window.setTimeout(() => {
                button.textContent = "Copy";
                button.setAttribute("aria-label", "Copy password");
            }, 1500);
        } catch {
            message.textContent =
                "Copy failed. Select the password and copy it manually.";
        }
    });

    return button;
}

function updateStrength(settings) {
    let alphabetSize = 0;

    if (settings.use_upper) {
        alphabetSize += settings.exclude_confusing ? 24 : 26;
    }

    if (settings.use_lower) {
        alphabetSize += settings.exclude_confusing ? 25 : 26;
    }

    if (settings.use_digits) {
        alphabetSize += settings.exclude_confusing ? 8 : 10;
    }

    if (settings.use_symbols) {
        alphabetSize += new Set(DEFAULT_SYMBOLS).size;
    }

    // This is an approximate estimate, not a password-cracking simulation.
    const entropy = settings.length * Math.log2(alphabetSize || 1);

    let label;
    let percentage;

    if (entropy < 40) {
        label = "Weak";
        percentage = 25;
    } else if (entropy < 60) {
        label = "Fair";
        percentage = 50;
    } else if (entropy < 80) {
        label = "Strong";
        percentage = 75;
    } else {
        label = "Very strong";
        percentage = 100;
    }

    strengthLabel.textContent = label;
    strengthBar.style.width = `${percentage}%`;
    strengthTrack.setAttribute("aria-valuenow", String(percentage));

    entropyText.textContent =
        `Approximate entropy: ${Math.floor(entropy)} bits`;
}

function displayHistory() {
    historyList.replaceChildren();

    passwordHistory.forEach((password, index) => {
        const item = document.createElement("div");
        item.className = "password-item";

        const passwordText = document.createElement("span");
        passwordText.className = "password-text";
        passwordText.textContent = `${index + 1}. ${password}`;

        item.append(passwordText, makeCopyButton(password));
        historyList.appendChild(item);
    });

    historySection.hidden = passwordHistory.length === 0;
}
