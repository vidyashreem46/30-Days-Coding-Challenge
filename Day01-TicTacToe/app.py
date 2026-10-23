
from flask import Flask, jsonify, render_template, request, session
from pathlib import Path
import random

BASE_DIR = Path(__file__).resolve().parent

app = Flask(
    __name__,
    template_folder=str(BASE_DIR),
    static_folder=None
)

# Local development only. Use an environment variable for deployment.
app.secret_key = "tic-tac-toe-local-development-key"

WINNING_COMBINATIONS = [
    (0, 1, 2), (3, 4, 5), (6, 7, 8),
    (0, 3, 6), (1, 4, 7), (2, 5, 8),
    (0, 4, 8), (2, 4, 6)
]

HUMAN_PLAYER = "X"
COMPUTER_PLAYER = "O"


def new_game(mode="pvp", difficulty="medium"):
    """Create a fresh game."""
    if mode not in ("pvp", "computer"):
        mode = "pvp"

    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"

    return {
        "board": [str(i) for i in range(1, 10)],
        "current_player": "X",
        "winner": None,
        "draw": False,
        "winning_cells": [],
        "mode": mode,
        "difficulty": difficulty,
        "history": [],
        "move_count": 0
    }


def get_game():
    if "game" not in session:
        session["game"] = new_game()
    return session["game"]


def check_winner(board):
    """Return X or O if a winning combination exists."""
    for a, b, c in WINNING_COMBINATIONS:
        if board[a] in ("X", "O") and board[a] == board[b] == board[c]:
            return board[a]
    return None


def find_winning_cells(board):
    """Return the indexes of the winning cells."""
    for combination in WINNING_COMBINATIONS:
        a, b, c = combination
        if board[a] in ("X", "O") and board[a] == board[b] == board[c]:
            return list(combination)
    return []


def finish_turn(game):
    """Update the winner, draw, move count and next player."""
    game["move_count"] = sum(
        cell in ("X", "O") for cell in game["board"]
    )

    game["winner"] = check_winner(game["board"])
    game["winning_cells"] = find_winning_cells(game["board"])

    game["draw"] = (
        game["winner"] is None
        and all(cell in ("X", "O") for cell in game["board"])
    )

    if not game["winner"] and not game["draw"]:
        game["current_player"] = (
            "O" if game["current_player"] == "X" else "X"
        )


def game_status(game):
    """Return the information needed by the frontend."""
    return {
        "board": game["board"],
        "current_player": game["current_player"],
        "winner": game["winner"],
        "draw": game["draw"],
        "winning_cells": game["winning_cells"],
        "mode": game["mode"],
        "difficulty": game["difficulty"],
        "move_count": game["move_count"],
        "can_undo": len(game["history"]) > 0
    }


def save_game(game):
    session["game"] = game
    session.modified = True


def available_moves(board):
    return [
        index for index, cell in enumerate(board)
        if cell not in ("X", "O")
    ]


def minimax(board, maximizing):
    """Find the best possible result for the computer."""
    winner = check_winner(board)

    if winner == COMPUTER_PLAYER:
        return 10

    if winner == HUMAN_PLAYER:
        return -10

    moves = available_moves(board)

    if not moves:
        return 0

    if maximizing:
        best_score = -float("inf")

        for index in moves:
            previous = board[index]
            board[index] = COMPUTER_PLAYER
            score = minimax(board, False)
            board[index] = previous
            best_score = max(best_score, score)

        return best_score

    best_score = float("inf")

    for index in moves:
        previous = board[index]
        board[index] = HUMAN_PLAYER
        score = minimax(board, True)
        board[index] = previous
        best_score = min(best_score, score)

    return best_score


def computer_move(game):
    """Choose a move according to the selected difficulty."""
    board = game["board"]
    moves = available_moves(board)

    if not moves:
        return

    difficulty = game["difficulty"]

    if difficulty == "easy":
        chosen = random.choice(moves)

    elif difficulty == "medium":
        # Usually play intelligently, but occasionally make a random move.
        if random.random() < 0.65:
            chosen = random.choice(moves)
        else:
            chosen = best_move(board, moves)
    else:
        chosen = best_move(board, moves)

    board[chosen] = COMPUTER_PLAYER
    finish_turn(game)


def best_move(board, moves=None):
    """Choose the optimal move using minimax."""
    if moves is None:
        moves = available_moves(board)

    best_score = -float("inf")
    chosen = moves[0]

    for index in moves:
        previous = board[index]
        board[index] = COMPUTER_PLAYER
        score = minimax(board, False)
        board[index] = previous

        if score > best_score:
            best_score = score
            chosen = index

    return chosen


def error_response(message, status=400):
    return jsonify({"error": message}), status


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/style.css")
def stylesheet():
    from flask import send_from_directory
    return send_from_directory(BASE_DIR, "style.css")


@app.route("/script.js")
def javascript():
    from flask import send_from_directory
    return send_from_directory(BASE_DIR, "script.js")


@app.route("/api/state", methods=["GET"])
def get_state():
    return jsonify(game_status(get_game()))


@app.route("/api/new", methods=["POST"])
def start_new_game():
    data = request.get_json(silent=True) or {}

    mode = data.get("mode", "pvp")
    difficulty = data.get("difficulty", "medium")

    if mode not in ("pvp", "computer"):
        return error_response("Choose a valid game mode.")

    if difficulty not in ("easy", "medium", "hard"):
        return error_response("Choose a valid difficulty.")

    game = new_game(mode, difficulty)
    save_game(game)

    return jsonify(game_status(game))



@app.route("/api/move", methods=["POST"])
def make_move():
    game = get_game()
    data = request.get_json(silent=True) or {}
    position = data.get("position")

    if game["winner"] or game["draw"]:
        return error_response("The game has ended. Start a new game.")

    if not isinstance(position, int) or isinstance(position, bool):
        return error_response("Position must be a number from 1 to 9.")

    if not 1 <= position <= 9:
        return error_response("Choose a position from 1 to 9.")

    if game["mode"] == "computer" and game["current_player"] != "X":
        return error_response("Wait for the AI to finish its turn.")

    index = position - 1

    if game["board"][index] in ("X", "O"):
        return error_response("That position is already occupied.")

    # Save the state before the human's move.
    game["history"].append({
        "board": game["board"].copy(),
        "current_player": game["current_player"],
        "winner": game["winner"],
        "draw": game["draw"],
        "winning_cells": game["winning_cells"].copy(),
        "move_count": game["move_count"]
    })

    game["board"][index] = game["current_player"]
    finish_turn(game)

    save_game(game)
    return jsonify(game_status(game))


@app.route("/api/computer-move", methods=["POST"])
def make_computer_move():
    game = get_game()

    if game["mode"] != "computer":
        return error_response("The game is not in AI mode.")

    if game["winner"] or game["draw"]:
        return error_response("The game has already ended.")

    if game["current_player"] != "O":
        return error_response("It is not the AI's turn.")

    computer_move(game)

    save_game(game)
    return jsonify(game_status(game))


@app.route("/api/undo", methods=["POST"])
def undo_move():
    game = get_game()

    if not game["history"]:
        return error_response("There are no moves to undo.")

    # In computer mode, undo the human move and computer response together.
    previous = game["history"].pop()

    game["board"] = previous["board"]
    game["current_player"] = previous["current_player"]
    game["winner"] = previous["winner"]
    game["draw"] = previous["draw"]
    game["winning_cells"] = previous["winning_cells"]
    game["move_count"] = previous["move_count"]

    save_game(game)
    return jsonify(game_status(game))


@app.route("/api/reset", methods=["POST"])
def reset_game():
    old_game = get_game()
    game = new_game(
        mode=old_game.get("mode", "pvp"),
        difficulty=old_game.get("difficulty", "medium")
    )

    save_game(game)
    return jsonify(game_status(game))


if __name__ == "__main__":
    app.run(debug=True)
