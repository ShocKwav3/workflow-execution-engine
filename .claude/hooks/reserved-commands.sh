#!/bin/sh
# PreToolUse(Bash) guard. The project reserves certain commands for the human operator
# (see artifacts/globalAgentInstructions.md §1-§3): installs, builds, tests, linting,
# migrations, database work, Docker, infrastructure, and Git writes.
#
# The agent may *suggest* these; it must not run them. This hook turns an attempt into a
# permission prompt rather than a silent execution, so approval is explicit and per-command.
#
# Output contract: print JSON with hookSpecificOutput.permissionDecision = "ask" to prompt.
# Printing nothing (exit 0) leaves the command to normal permission handling.

payload=$(cat)

if command -v jq >/dev/null 2>&1; then
  command_text=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')
else
  command_text=$(printf '%s' "$payload" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p')
fi

[ -z "$command_text" ] && exit 0

ask() {
  reason="$1"
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":%s}}\n' \
    "$(printf '%s' "$reason" | sed 's/\\/\\\\/g; s/"/\\"/g; s/^/"/; s/$/"/')"
  exit 0
}

# Package manager: any invocation. Covers install, build, test, lint, dev, start, deploy.
if printf '%s' "$command_text" | grep -Eq '(^|[;&|(]|&&|\|\|)[[:space:]]*(pnpm|npm|yarn|npx|bunx)([[:space:]]|$)'; then
  ask "Package manager commands (install, build, test, lint, dev) are the operator's to run. Suggest the command instead."
fi

# Build/test/lint tools invoked directly rather than through a script.
if printf '%s' "$command_text" | grep -Eq '(^|[;&|(]|&&|\|\|)[[:space:]]*(tsc|tsc-alias|vitest|eslint|prettier|spectral)([[:space:]]|$)'; then
  ask "Build, test, and lint tooling is the operator's to run. Suggest the command instead."
fi

# Containers and Compose.
if printf '%s' "$command_text" | grep -Eq '(^|[;&|(]|&&|\|\|)[[:space:]]*(docker|docker-compose|podman)([[:space:]]|$)'; then
  ask "Docker and Compose operations are the operator's to run. Suggest the command instead."
fi

# Database and migrations.
if printf '%s' "$command_text" | grep -Eq '(^|[;&|(]|&&|\|\|)[[:space:]]*(liquibase|psql|pg_dump|pg_restore|pg_isready)([[:space:]]|$)'; then
  ask "Database and migration commands are the operator's to run. Suggest the command instead."
fi

# Infrastructure, for the later milestones.
if printf '%s' "$command_text" | grep -Eq '(^|[;&|(]|&&|\|\|)[[:space:]]*(terraform|kubectl|helm|aws)([[:space:]]|$)'; then
  ask "Infrastructure commands are the operator's to run. Suggest the command instead."
fi

# Running the app itself.
if printf '%s' "$command_text" | grep -Eq '(^|[;&|(]|&&|\|\|)[[:space:]]*node([[:space:]]|$)'; then
  ask "Starting application processes is the operator's to run. Suggest the command instead."
fi

# Git writes. Read-only inspection (status, log, diff, show, branch listing) stays allowed,
# since the agent needs to see repository state to report on it accurately.
if printf '%s' "$command_text" | grep -Eq '(^|[;&|(]|&&|\|\|)[[:space:]]*git[[:space:]]+(add|commit|push|pull|fetch|merge|rebase|reset|revert|checkout|switch|restore|cherry-pick|stash|tag|rm|mv|clean|apply|am|worktree|remote|submodule|config)([[:space:]]|$)'; then
  ask "Git is entirely the operator's responsibility. Suggest the command or commit message instead."
fi

exit 0
