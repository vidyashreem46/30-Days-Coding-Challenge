
import secrets
import string

from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__)

DEFAULT_SYMBOLS = "!@#$%^&*()-_=+?"
CONFUSING_CHARACTERS = set("O0Il")


def generate_password(
    length,
    use_upper=True,
    use_lower=True,
    use_digits=True,
    use_symbols=True,
    exclude_confusing=False,
):
    """Generate a password using Python's cryptographically secure secrets module."""

    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits

    if exclude_confusing:
        uppercase = "".join(
            char for char in uppercase
            if char not in CONFUSING_CHARACTERS
        )
        lowercase = "".join(
            char for char in lowercase
            if char not in CONFUSING_CHARACTERS
        )
        digits = "".join(
            char for char in digits
            if char not in CONFUSING_CHARACTERS
        )

    groups = []

    if use_upper:
        groups.append(uppercase)
    if use_lower:
        groups.append(lowercase)
    if use_digits:
        groups.append(digits)
    if use_symbols:
        groups.append(DEFAULT_SYMBOLS)

    if not groups:
        raise ValueError("Select at least one character type.")

    if length < len(groups):
        raise ValueError(
            "Password length is too short for the selected character types."
        )

    character_pool = "".join(groups)

    # Guarantee at least one character from every selected group.
    password_characters = [
        secrets.choice(group) for group in groups
    ]

    # Fill the remaining positions using the combined character pool.
    for _ in range(length - len(password_characters)):
        password_characters.append(secrets.choice(character_pool))

    # Securely randomize character positions.
    secrets.SystemRandom().shuffle(password_characters)

    return "".join(password_characters)


@app.route("/")
def home():
    return send_from_directory(app.root_path, "index.html")


@app.route("/style.css")
def stylesheet():
    return send_from_directory(app.root_path, "style.css")


@app.route("/script.js")
def javascript():
    return send_from_directory(app.root_path, "script.js")


@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Please send a valid JSON request."}), 400

    length = data.get("length")
    count = data.get("count", 1)

    if type(length) is not int or not 8 <= length <= 128:
        return jsonify({
            "error": "Password length must be between 8 and 128."
        }), 400

    if type(count) is not int or not 1 <= count <= 10:
        return jsonify({
            "error": "Choose between 1 and 10 passwords."
        }), 400

    option_names = [
        "use_upper",
        "use_lower",
        "use_digits",
        "use_symbols",
        "exclude_confusing",
    ]

    options = {}

    for option in option_names:
        value = data.get(option, False)

        if not isinstance(value, bool):
            return jsonify({
                "error": f"Invalid value for {option}."
            }), 400

        options[option] = value

    character_options = option_names[:4]

    if not any(options[name] for name in character_options):
        return jsonify({
            "error": "Select at least one character type."
        }), 400

    selected_type_count = sum(
        options[name] for name in character_options
    )

    if length < selected_type_count:
        return jsonify({
            "error": "Password length is too short for your selections."
        }), 400

    passwords = []

    try:
        for _ in range(count):
            password = generate_password(
                length=length,
                use_upper=options["use_upper"],
                use_lower=options["use_lower"],
                use_digits=options["use_digits"],
                use_symbols=options["use_symbols"],
                exclude_confusing=options["exclude_confusing"],
            )
            passwords.append(password)

    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    return jsonify({"passwords": passwords})


if __name__ == "__main__":
    # Local development only. Do not use debug mode in production.
    app.run(debug=True)
