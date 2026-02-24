#!/usr/bin/env bash
set -euo pipefail

PROFILE="$HOME/.profile"
BASHRC="$HOME/.bashrc"

ensure_block() {
  local file="$1"
  local marker="# >>> nvm auto-load >>>"
  if ! grep -Fq "$marker" "$file" 2>/dev/null; then
    {
      echo
      echo "# >>> nvm auto-load >>>"
      echo 'export NVM_DIR="$HOME/.nvm"'
      echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"'
      echo "# <<< nvm auto-load <<<"
    } >> "$file"
  fi
}

touch "$PROFILE" "$BASHRC"
ensure_block "$PROFILE"
ensure_block "$BASHRC"

# Ensure nvm is available in current shell for checks
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

# Ensure pnpm exists in current nvm node
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable || true
    corepack prepare pnpm@latest --activate || true
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm
fi

echo "OK_PROFILE_BLOCK=$(grep -F -c '# >>> nvm auto-load >>>' \"$PROFILE\")"
echo "OK_BASHRC_BLOCK=$(grep -F -c '# >>> nvm auto-load >>>' \"$BASHRC\")"
echo "NODE=$(node -v)"
echo "NPM=$(npm -v)"
echo "PNPM=$(pnpm -v)"
