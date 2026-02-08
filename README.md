# CSSS Documentation

## Why?
*   **Anti-Cheat**: Keeps answers on the server, not in the file.
*   **Unified**: Labs and Quizzes in one place.
*   **Competition**: Live leaderboards.

## Running the Server
1.  `npm install`
2.  `npm start`
3.  Access at `http://localhost:3000`

---

## 1. Packet Tracer Labs (`lab.conf`)

Defined in `[[labs]]` blocks.

### Lab Check Types (The 4 Core Logic Types)

#### 1. ConfigMatch (Exact String)
Use this for static commands that never change.
```toml
type = "ConfigMatch"
value = "hostname R1"
```

#### 2. ConfigRegex (Pattern Match)
Use this for variable data like **Encrypted Passwords** or descriptions.
```toml
type = "ConfigRegex"
# Matches: enable secret 5 $1$AbCd...
value = "^enable secret 5 \\$1\\$.*"
```

#### 3. XmlMatch (XML Exact)
Use this to check specific values within the `.pka` XML structure (e.g., Device Type, Coordinates, Power Status).
```toml
type = "XmlMatch"
# Checks if the device type is exactly "Router"
path = ["TYPE"]
value = "Router"
```

#### 4. XmlRegex (XML Pattern)
Use this to check if a value inside the XML matches a pattern (e.g., Serial Numbers, MAC Addresses).
```toml
type = "XmlRegex"
path = ["SERIALNUMBER"]
value = "^FDO.*"
```

---

## 2. Quizzes (`quiz.conf`)

Defined in `[[quizzes]]` blocks.

### Quiz Question Types

*   **radio**: Single choice.
*   **checkbox**: Multiple correct answers.
*   **text**: Regex-validated text input.
    ```toml
    type = "text"
    # Matches "wr" or "write memory"
    regex = "^(wr|write memory)$"
    ```
*   **matching**: Drag and drop terms.

## Server-Sided Security
*   **No Answers on Client**: All grading logic (`grading.js`) runs in a hidden worker thread on the server.
*   **Input Blocking**: Quizzes disable Copy/Paste.
*   **Attempts**: Hard limits on how many times a user can submit.

## Free Servers
*   [Koyeb](https://www.koyeb.com/) and [Render](https://render.com/).
*   Use [cron-job.org](https://console.cron-job.org/login) to ping the server every 10 minutes to prevent sleeping.
