# Agent startup integration for GitHub coding agent (web UI / API)

This repository includes `scripts/agent-bootstrap.sh`. Run this at the start of a GitHub coding agent session so the agent has a concise repo summary available in session context.

What the script does
- Updates submodules (best-effort)
- Attempts to fetch LFS objects (best-effort)
- Detects common package managers
- Produces `.agent-context.json` (a small JSON summary) and prints it to stdout

Using the script in the GitHub coding agent web UI
1. Open a new coding agent session in the repository via the web UI.
2. In the "Problem statement" (or the first instruction) paste the exact text from the "Problem statement to paste" section below.
3. The agent will run `scripts/agent-bootstrap.sh`, capture its stdout and `.agent-context.json`, and include that JSON in the session context before taking other actions.

Problem statement to paste (exact)
> First, run `./scripts/agent-bootstrap.sh` in the repository root. Capture the script's stdout and the file `.agent-context.json`. Parse the JSON and include it in your context as `agent_context` (top of context). If the script reports fatal errors, stop and list the errors. If the JSON contains warnings, include them inline when proposing next steps.

Using the script when starting a coding session via API
- When creating a session with the coding-agent API, include the same problem statement in the session creation payload so the agent will execute the script automatically at session start and ingest the produced JSON into the context.

Notes & best practices
- Keep `.agent-context.json` small and structured (JSON). The script tries to keep output compact.
- Do NOT auto-run the bootstrap script on untrusted forks—validate commit SHAs or signatures where necessary.
- If your agent runtime does not allow executing repo scripts, run the script locally or in a CI job, then provide the produced JSON to the agent (e.g., paste content into problem statement or upload as a session artifact).

If you'd like, I can:
- Produce a PR that adds these files to your repo, or
- Generate the exact API payload / curl command to create a coding session with this problem statement (tell me the repo owner/name and whether you want me to open a PR that adds the files automatically).
