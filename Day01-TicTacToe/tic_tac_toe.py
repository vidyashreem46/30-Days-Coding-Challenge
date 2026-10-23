
board = ["1", "2", "3",
         "4", "5", "6",
         "7", "8", "9"]


def display_board():
    print()
    print(" " + board[0] + " | " + board[1] + " | " + board[2])
    print("---+---+---")
    print(" " + board[3] + " | " + board[4] + " | " + board[5])
    print("---+---+---")
    print(" " + board[6] + " | " + board[7] + " | " + board[8])
    print()


def check_winner():
    winning_combinations = [
        (0, 1, 2), (3, 4, 5), (6, 7, 8),
        (0, 3, 6), (1, 4, 7), (2, 5, 8),
        (0, 4, 8), (2, 4, 6)
    ]

    for a, b, c in winning_combinations:
        if board[a] == board[b] == board[c]:
            return board[a]

    return None


def play_game():
    current_player = "X"

    while True:
        display_board()
        position = input(
            f"Player {current_player}, choose a position (1-9): "
        ).strip()

        if not position.isdigit():
            print("Please enter a number from 1 to 9.")
            continue

        position = int(position)

        if position < 1 or position > 9:
            print("Invalid position! Choose from 1 to 9.")
            continue

        index = position - 1

        if board[index] in ("X", "O"):
            print("That position is already occupied!")
            continue

        board[index] = current_player

        winner = check_winner()

        if winner:
            display_board()
            print(f"Congratulations! Player {winner} wins!")
            break

        if all(cell in ("X", "O") for cell in board):
            display_board()
            print("It's a draw!")
            break

        current_player = "O" if current_player == "X" else "X"


print("Welcome to Tic-Tac-Toe!")
play_game()
