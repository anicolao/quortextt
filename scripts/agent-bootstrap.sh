#!/usr/bin/env bash
set -euo pipefail

# Lightweight agent bootstrap script for GitHub coding agent sessions.
# Produces ".agent-context.json" in the repo root and prints it to stdout.
# Non-fatal steps print warnings; script exits non-zero only on fatal problems.

OUT_FILE=".agent-context.json"
TMP_FILE="$(mktemp)"

echo "=== agent-bootstrap: starting ===" >&2

# Safe helpers
jq_exists() { command -v jq >/dev/null 2>&1; }

# Gather Git metadata (best-effort)
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo '')"
GIT_STATUS="$(git status --porcelain 2>/dev/null || echo '')"

# Update submodules (non-fatal)
if [ -f .gitmodules ]; then
  echo "Updating git submodules..." >&2
  git submodule sync --recursive || echo "warning: submodule sync failed" >&2
  git submodule update --init --recursive || echo "warning: submodule update failed" >&2
fi

# Try fetch LFS (non-fatal)
if command -v git-lfs >/dev/null 2>&1; then
  echo "Fetching git LFS objects..." >&2
  git lfs pull || echo "warning: git lfs pull failed" >&2
fi

# Detect package managers (non-invasive)
PKGS=()
[ -f package.json ] && PKGS+=("npm")
[ -f yarn.lock ] && PKGS+=("yarn")
[ -f requirements.txt ] && PKGS+=("pip")
[ -f Pipfile ] && PKGS+=("pipenv")
[ -f pyproject.toml ] && PKGS+=("poetry")
[ -f go.mod ] && PKGS+=("go")
[ -f composer.json ] && PKGS+=("composer")

# Small dependency preview (safe, non-installing)
DEPS_SUMMARY=""
if [ -f package.json ] && command -v jq >/dev/null 2>&1; then
  DEPS_SUMMARY="$(jq '{deps: (.dependencies // {}), devDeps: (.devDependencies // {})} | {deps: ( .deps | keys[0:20] ), devDeps: ( .devDeps | keys[0:20] )}' package.json 2>/dev/null || true)"
fi

# Minimal environment capture (non-sensitive keys only)
ENV_PREVIEW="$(env | grep -E '^(NODE|PYTHON|GITHUB|PATH|HOME)=' | head -n 40 || true)"

# Build JSON output
if jq_exists; then
  # Handle empty PKGS array safely
  if [ ${#PKGS[@]} -eq 0 ]; then
    PKGS_JSON="[]"
  else
    PKGS_JSON="$(printf '%s\n' "${PKGS[@]}" | jq -R . | jq -s .)"
  fi
  jq -n \
    --arg branch "$GIT_BRANCH" \
    --arg commit "$GIT_COMMIT" \
    --arg status "$GIT_STATUS" \
    --argjson pkgs "$PKGS_JSON" \
    --arg deps "$DEPS_SUMMARY" \
    --arg env "$ENV_PREVIEW" \
    '{branch: $branch, commit: $commit, git_status: $status, detected_package_managers: $pkgs, deps_summary: ($deps|fromjson? // $deps), env_preview: $env}' > "$TMP_FILE" 2>/dev/null || true
fi

# If jq not available or above failed, fallback to basic JSON
if [ ! -s "$TMP_FILE" ]; then
  if [ ${#PKGS[@]} -eq 0 ]; then
    PKG_LIST="[]"
  else
    PKG_LIST="$(printf '"%s",' "${PKGS[@]}" | sed 's/,$//')"
    PKG_LIST="[$PKG_LIST]"
  fi
  cat > "$TMP_FILE" <<EOF
{
  "branch": "$(printf '%s' "$GIT_BRANCH" | sed 's/"/\\"/g')",
  "commit": "$(printf '%s' "$GIT_COMMIT" | sed 's/"/\\"/g')",
  "git_status": "$(printf '%s' "$GIT_STATUS" | sed 's/"/\\"/g')",
  "detected_package_managers": $PKG_LIST,
  "deps_summary": "$(printf '%s' "$DEPS_SUMMARY" | sed 's/"/\\"/g')",
  "env_preview": "$(printf '%s' "$ENV_PREVIEW" | sed 's/"/\\"/g')"
}
EOF
fi

mv "$TMP_FILE" "$OUT_FILE" || (echo "fatal: could not write $OUT_FILE" >&2 && exit 2)
chmod 644 "$OUT_FILE" || true

echo "=== agent-bootstrap: produced $OUT_FILE ===" >&2
# Print the JSON so hosting agent can capture stdout
cat "$OUT_FILE"
echo "=== agent-bootstrap: done ===" >&2
