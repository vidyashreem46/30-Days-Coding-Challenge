
const cells = [...document.querySelectorAll(".cell")];
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const difficultyButtons = [...document.querySelectorAll("[data-difficulty]")];
const difficultyGroup = document.getElementById("difficulty-group");

const statusElement = document.getElementById("status");
const messageElement = document.getElementById("message");
const undoButton = document.getElementById("undo-button");
const soundButton = document.getElementById("sound-button");
const resetButton = document.getElementById("reset-button");

const resultPanel = document.getElementById("result-panel");
const resultIcon = document.getElementById("result-icon");
const resultTitle = document.getElementById("result-title");
const resultDescription = document.getElementById("result-description");

const scoreXElement = document.getElementById("score-x");
const scoreOElement = document.getElementById("score-o");
const drawCountElement = document.getElementById("draw-count");
const moveCountElement = document.getElementById("move-count");

const playerXCard = document.getElementById("player-x");
const playerOCard = document.getElementById("player-o");
const labelX = document.getElementById("label-x");
const labelO = document.getElementById("label-o");

let gameState = null;
let isBusy = false;
let soundEnabled = false;
let audioContext = null;
let confettiTimer = null;

const scores = {
    X: { wins: 0, losses: 0 },
    O: { wins: 0, losses: 0 },
    draws: 0
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

function showMessage(message = "") {
    messageElement.textContent = message;
}

// --------------------------------------------------
// FRIENDLY IN-GAME CONFIRMATION
// No browser confirm() popup.
// --------------------------------------------------

function confirmInsideGame(message) {
    return new Promise(resolve => {
        document.getElementById("game-confirm-overlay")?.remove();

        if (!document.getElementById("game-confirm-styles")) {
            const style = document.createElement("style");
            style.id = "game-confirm-styles";
            style.textContent = `
                .game-confirm-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    background: rgba(42, 35, 65, .48);
                    backdrop-filter: blur(4px);
                }

                .game-confirm-card {
                    width: min(100%, 360px);
                    padding: 26px 22px;
                    border: 3px solid #f4d8ff;
                    border-radius: 24px;
                    background: #fff;
                    box-shadow: 0 16px 45px rgba(50, 30, 80, .22);
                    text-align: center;
                    font-family: inherit;
                    animation: game-confirm-pop 180ms ease-out;
                }

                .game-confirm-emoji {
                    margin-bottom: 8px;
                    font-size: 42px;
                }

                .game-confirm-card h2 {
                    margin: 0 0 10px;
                    color: #6541a5;
                    font-size: 1.35rem;
                }

                .game-confirm-card p {
                    margin: 0 0 22px;
                    color: #5e5870;
                    line-height: 1.5;
                }

                .game-confirm-actions {
                    display: flex;
                    justify-content: center;
                    flex-wrap: wrap;
                    gap: 10px;
                }

                .game-confirm-actions button {
                    border: 0;
                    border-radius: 14px;
                    padding: 11px 17px;
                    font: inherit;
                    font-weight: 800;
                    cursor: pointer;
                }

                .game-confirm-cancel {
                    color: #5b5470;
                    background: #f0edf7;
                }

                .game-confirm-start {
                    color: white;
                    background: #8b5cf6;
                }

                .game-confirm-actions button:focus-visible {
                    outline: 3px solid #ffbd69;
                    outline-offset: 3px;
                }

                @keyframes game-confirm-pop {
                    from {
                        opacity: 0;
                        transform: scale(.94) translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .game-confirm-card {
                        animation: none;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        const overlay = document.createElement("div");
        overlay.id = "game-confirm-overlay";
        overlay.className = "game-confirm-overlay";

        const card = document.createElement("section");
        card.className = "game-confirm-card";
        card.setAttribute("role", "dialog");
        card.setAttribute("aria-modal", "true");
        card.setAttribute("aria-labelledby", "game-confirm-title");

        const emoji = document.createElement("div");
        emoji.className = "game-confirm-emoji";
        emoji.textContent = "🎮";
        emoji.setAttribute("aria-hidden", "true");

        const heading = document.createElement("h2");
        heading.id = "game-confirm-title";
        heading.textContent = "Start a new game?";

        const description = document.createElement("p");
        description.textContent = message;

        const actions = document.createElement("div");
        actions.className = "game-confirm-actions";

        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "game-confirm-cancel";
        cancelButton.textContent = "Keep Playing";

        const startButton = document.createElement("button");
        startButton.type = "button";
        startButton.className = "game-confirm-start";
        startButton.textContent = "Yes, Start!";

        actions.append(cancelButton, startButton);
        card.append(emoji, heading, description, actions);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        const handleEscape = event => {
            if (event.key === "Escape") finish(false);
        };

        const finish = confirmed => {
            document.removeEventListener("keydown", handleEscape);
            overlay.remove();
            resolve(confirmed);
        };

        cancelButton.addEventListener("click", () => finish(false));
        startButton.addEventListener("click", () => finish(true));

        overlay.addEventListener("click", event => {
            if (event.target === overlay) finish(false);
        });

        document.addEventListener("keydown", handleEscape);
        cancelButton.focus();
    });
}

// --------------------------------------------------
// GAME MODE AND SCOREBOARD
// --------------------------------------------------

function selectedMode() {
    return modeButtons.find(button =>
        button.classList.contains("active")
    )?.dataset.mode || "pvp";
}

function selectedDifficulty() {
    return difficultyButtons.find(button =>
        button.classList.contains("active")
    )?.dataset.difficulty || "medium";
}

function updateScores() {
    scoreXElement.textContent = scores.X.wins;
    scoreOElement.textContent = scores.O.wins;
    drawCountElement.textContent = scores.draws;

    playerXCard.querySelector(".score-caption").textContent =
        `${scores.X.wins} WINS · ${scores.X.losses} LOSSES`;

    playerOCard.querySelector(".score-caption").textContent =
        `${scores.O.wins} WINS · ${scores.O.losses} LOSSES`;
}

function updatePlayerLabels() {
    if (gameState.mode === "computer") {
        labelX.textContent = "YOU · X";
        labelO.textContent = "AI · O";
    } else {
        labelX.textContent = "PLAYER X";
        labelO.textContent = "PLAYER O";
    }
}

function updateBoard() {
    if (!gameState) return;

    const aiTurn =
        gameState.mode === "computer" &&
        gameState.current_player === "O";

    cells.forEach((cell, index) => {
        const value = gameState.board[index];
        const occupied = value === "X" || value === "O";

        cell.textContent = occupied ? value : "";
        cell.classList.toggle("x", value === "X");
        cell.classList.toggle("o", value === "O");

        cell.classList.toggle(
            "winning-cell",
            gameState.winning_cells.includes(index)
        );

        cell.disabled =
            isBusy ||
            occupied ||
            Boolean(gameState.winner) ||
            Boolean(gameState.draw) ||
            aiTurn;

        cell.setAttribute(
            "aria-label",
            occupied
                ? `Position ${index + 1}: ${value}`
                : `Position ${index + 1}: empty`
        );
    });

    moveCountElement.textContent = `${gameState.move_count} / 9`;
    undoButton.disabled = isBusy || !gameState.can_undo;

    updatePlayerLabels();

    playerXCard.classList.toggle(
        "active",
        !gameState.winner &&
        !gameState.draw &&
        gameState.current_player === "X"
    );

    playerOCard.classList.toggle(
        "active",
        !gameState.winner &&
        !gameState.draw &&
        gameState.current_player === "O"
    );

    if (gameState.winner) {
        statusElement.textContent =
            gameState.mode === "computer"
                ? gameState.winner === "X"
                    ? "You won! Let's celebrate! 🎉"
                    : "The AI won this time. Try again! 💪"
                : `Player ${gameState.winner} wins! 🎉`;
    } else if (gameState.draw) {
        statusElement.textContent =
            "It's a draw! You're both awesome! 🤝";
    } else if (aiTurn) {
        statusElement.textContent = "AI is thinking… 🤔";
    } else {
        statusElement.textContent =
            `Player ${gameState.current_player}'s turn`;
    }
}

// --------------------------------------------------
// SOUND SYSTEM
// --------------------------------------------------

function getAudioContext() {
    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!audioContext) {
        audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    return audioContext;
}

function playTone(
    frequency,
    startTime,
    duration,
    volume = 0.06,
    type = "sine"
) {
    const context = getAudioContext();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(
        volume,
        startTime + 0.025
    );
    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + duration
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
}

function playSound(type) {
    if (!soundEnabled) return;

    try {
        const context = getAudioContext();
        if (!context) return;

        const frequencies = {
            move: 480,
            win: 720,
            draw: 340,
            error: 190
        };

        playTone(
            frequencies[type] || 480,
            context.currentTime,
            0.15,
            0.055
        );
    } catch (error) {
        console.warn("Sound is unavailable.", error);
    }
}

function playCelebrationSound(type) {
    if (!soundEnabled) return;

    try {
        const context = getAudioContext();
        if (!context) return;

        const now = context.currentTime;

        if (type === "win") {
            [523, 659, 784, 1047].forEach((note, index) => {
                playTone(
                    note,
                    now + index * 0.13,
                    0.22,
                    0.075,
                    "triangle"
                );
            });

            playTone(784, now + 0.58, 0.34, 0.055);
        } else if (type === "loss") {
            [440, 392, 330].forEach((note, index) => {
                playTone(
                    note,
                    now + index * 0.19,
                    0.24,
                    0.045,
                    "sine"
                );
            });
        } else {
            [440, 523].forEach((note, index) => {
                playTone(
                    note,
                    now + index * 0.18,
                    0.2,
                    0.05,
                    "triangle"
                );
            });
        }
    } catch (error) {
        console.warn("Celebration sound is unavailable.", error);
    }
}

// --------------------------------------------------
// CONFETTI CELEBRATION
// --------------------------------------------------

function launchConfetti(intensity = 1) {
    if (!document.getElementById("celebration-effect-styles")) {
        const style = document.createElement("style");
        style.id = "celebration-effect-styles";

        style.textContent = `
            .confetti-layer {
                position: fixed;
                inset: 0;
                overflow: hidden;
                pointer-events: none;
                z-index: 9999;
            }

            .confetti-piece {
                position: absolute;
                top: -24px;
                border-radius: 3px;
                opacity: .95;
                animation: confetti-fall var(--fall-time, 2.8s)
                    linear forwards;
            }

            @keyframes confetti-fall {
                0% {
                    transform: translate3d(0, -10px, 0) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translate3d(var(--drift, 0px), 110vh, 0)
                        rotate(760deg);
                    opacity: .8;
                }
            }

            #result-panel.celebrating {
                animation: happy-pop 650ms cubic-bezier(.2, .8, .3, 1.3);
            }

            @keyframes happy-pop {
                0% { transform: scale(.88); }
                55% { transform: scale(1.06); }
                100% { transform: scale(1); }
            }

            @media (prefers-reduced-motion: reduce) {
                .confetti-piece { animation-duration: 1ms !important; }
                #result-panel.celebrating { animation: none; }
            }
        `;

        document.head.appendChild(style);
    }

    document.querySelector(".confetti-layer")?.remove();

    if (confettiTimer) clearTimeout(confettiTimer);

    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    layer.setAttribute("aria-hidden", "true");

    const colors = [
        "#ff6b8a", "#ffd166", "#70d6ff",
        "#8ce99a", "#b197fc", "#ff9f43"
    ];

    const pieceCount = intensity >= 2 ? 125 : 80;

    for (let index = 0; index < pieceCount; index++) {
        const piece = document.createElement("span");
        piece.className = "confetti-piece";

        piece.style.left = `${Math.random() * 100}%`;
        piece.style.backgroundColor =
            colors[Math.floor(Math.random() * colors.length)];

        piece.style.setProperty(
            "--fall-time",
            `${2.2 + Math.random() * 1.4}s`
        );

        piece.style.setProperty(
            "--drift",
            `${Math.round(Math.random() * 220 - 110)}px`
        );

        piece.style.animationDelay = `${Math.random() * 0.55}s`;
        piece.style.width = `${6 + Math.random() * 7}px`;
        piece.style.height = `${9 + Math.random() * 11}px`;

        layer.appendChild(piece);
    }

    document.body.appendChild(layer);

    resultPanel.classList.remove("celebrating");
    void resultPanel.offsetWidth;
    resultPanel.classList.add("celebrating");

    confettiTimer = setTimeout(() => {
        layer.remove();
        resultPanel.classList.remove("celebrating");
        confettiTimer = null;
    }, 4300);
}

function clearCelebration() {
    document.querySelector(".confetti-layer")?.remove();

    if (confettiTimer) {
        clearTimeout(confettiTimer);
        confettiTimer = null;
    }

    resultPanel.classList.remove("celebrating");
}

// --------------------------------------------------
// WIN, LOSS AND DRAW RESULTS
// --------------------------------------------------

function showResult(previousState) {
    if (!gameState.winner && !gameState.draw) {
        resultPanel.hidden = true;
        return;
    }

    resultPanel.hidden = false;

    if (
        !previousState ||
        previousState.winner ||
        previousState.draw
    ) {
        return;
    }

    if (gameState.winner) {
        const winner = gameState.winner;
        const loser = winner === "X" ? "O" : "X";
        const aiWon =
            gameState.mode === "computer" && winner === "O";

        scores[winner].wins++;
        scores[loser].losses++;

        if (aiWon) {
            resultIcon.textContent = "🤖";
            resultTitle.textContent = "AI Wins This Time!";
            resultDescription.textContent =
                "Aww, so close! Try again — you can beat the AI! 💪";

            playCelebrationSound("loss");
        } else {
            resultIcon.textContent = "🏆";

            resultTitle.textContent =
                gameState.mode === "computer"
                    ? "You Win!"
                    : `Player ${winner} Wins!`;

            resultDescription.textContent =
                gameState.mode === "computer"
                    ? "You did it! You beat the AI! You're a champion! 🥳"
                    : `Amazing! Congratulations, Player ${winner}! You're the champion! 🎉`;

            launchConfetti(
                gameState.mode === "computer" ? 2 : 1
            );

            playCelebrationSound("win");
        }
    } else {
        scores.draws++;

        resultIcon.textContent = "🤝";
        resultTitle.textContent = "It's a Draw!";
        resultDescription.textContent =
            "You're both awesome! Play another round and try again! 🌈";

        playCelebrationSound("draw");
    }

    updateScores();
}

function render(previousState = null) {
    updateBoard();
    showResult(previousState);
}

// --------------------------------------------------
// LOAD GAME
// --------------------------------------------------

async function loadGame() {
    try {
        gameState = await apiRequest("/api/state");

        modeButtons.forEach(button => {
            const active = button.dataset.mode === gameState.mode;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });

        difficultyButtons.forEach(button => {
            const active =
                button.dataset.difficulty === gameState.difficulty;

            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });

        difficultyGroup.hidden = gameState.mode !== "computer";
        render();
    } catch (error) {
        statusElement.textContent =
            "Could not connect to the game server.";
        showMessage(error.message);
    }
}

// --------------------------------------------------
// PLAYER MOVE AND AI RESPONSE
// --------------------------------------------------

async function makeMove(position) {
    if (isBusy || !gameState) return;

    const cellValue = gameState.board[position - 1];

    if (
        cellValue === "X" ||
        cellValue === "O" ||
        gameState.winner ||
        gameState.draw
    ) {
        return;
    }

    isBusy = true;
    showMessage("");
    updateBoard();

    try {
        const previousState = gameState;

        gameState = await apiRequest("/api/move", {
            method: "POST",
            body: JSON.stringify({ position })
        });

        playSound("move");
        render(previousState);

        if (
            gameState.mode === "computer" &&
            !gameState.winner &&
            !gameState.draw &&
            gameState.current_player === "O"
        ) {
            await sleep(600);

            const beforeAiMove = gameState;

            gameState = await apiRequest("/api/computer-move", {
                method: "POST",
                body: JSON.stringify({})
            });

            render(beforeAiMove);
        }
    } catch (error) {
        showMessage(error.message);
        playSound("error");
    } finally {
        isBusy = false;
        updateBoard();
    }
}

// --------------------------------------------------
// NEW GAME / RESET
// --------------------------------------------------

async function startNewGame(askConfirmation = true) {
    if (isBusy) return;

    const unfinished =
        gameState &&
        !gameState.winner &&
        !gameState.draw &&
        gameState.move_count > 0;

    if (
        askConfirmation &&
        unfinished &&
        !(await confirmInsideGame(
            "You've still got a game in progress. Do you want to start fresh?"
        ))
    ) {
        return;
    }

    isBusy = true;
    showMessage("");
    updateBoard();

    try {
        gameState = await apiRequest("/api/new", {
            method: "POST",
            body: JSON.stringify({
                mode: selectedMode(),
                difficulty: selectedDifficulty()
            })
        });

        clearCelebration();
        resultPanel.hidden = true;
        render();
    } catch (error) {
        showMessage(`Oops! ${error.message}`);
    } finally {
        isBusy = false;
        updateBoard();
    }
}

// --------------------------------------------------
// UNDO
// --------------------------------------------------

async function undoMove() {
    if (isBusy || !gameState?.can_undo) return;

    isBusy = true;
    showMessage("");

    try {
        gameState = await apiRequest("/api/undo", {
            method: "POST",
            body: JSON.stringify({})
        });

        clearCelebration();
        resultPanel.hidden = true;
        render();
    } catch (error) {
        showMessage(`Couldn't undo that move: ${error.message}`);
    } finally {
        isBusy = false;
        updateBoard();
    }
}

// --------------------------------------------------
// GAME MODE BUTTONS
// --------------------------------------------------

modeButtons.forEach(button => {
    button.addEventListener("click", () => {
        if (isBusy || button.classList.contains("active")) return;

        modeButtons.forEach(item => {
            const active = item === button;
            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
        });

        difficultyGroup.hidden = button.dataset.mode !== "computer";
        startNewGame(false);
    });
});

// --------------------------------------------------
// AI DIFFICULTY BUTTONS
// --------------------------------------------------

difficultyButtons.forEach(button => {
    button.addEventListener("click", () => {
        if (isBusy || button.classList.contains("active")) return;

        difficultyButtons.forEach(item => {
            const active = item === button;
            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
        });

        startNewGame(false);
    });
});

// --------------------------------------------------
// BOARD AND CONTROL BUTTONS
// --------------------------------------------------

cells.forEach(cell => {
    cell.addEventListener("click", () => {
        makeMove(Number(cell.dataset.position));
    });
});

resetButton.addEventListener("click", () => {
    startNewGame(true);
});

undoButton.addEventListener("click", undoMove);

soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    soundButton.textContent = soundEnabled
        ? "Sound: On"
        : "Sound: Off";

    soundButton.setAttribute(
        "aria-pressed",
        String(soundEnabled)
    );

    if (soundEnabled) playSound("move");
});

// Start the game.
updateScores();
loadGame();
