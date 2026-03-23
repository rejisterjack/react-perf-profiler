#!/usr/bin/env sh
# Installs git hooks for the project.
# Called automatically via the "prepare" npm lifecycle script.

HOOKS_DIR=".git/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "⚠️  .git/hooks directory not found — skipping hook installation (CI or non-repo context)"
  exit 0
fi

cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/usr/bin/env sh
# Pre-commit hook: run Biome lint on staged TypeScript/TSX files.

STAGED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx)$' || true)

if [ -z "$STAGED" ]; then
  exit 0
fi

echo "🔍 Running Biome lint on staged files..."
# Pass staged files directly to biome so only changed files are checked
echo "$STAGED" | xargs pnpm exec biome lint --no-errors-on-unmatched 2>&1

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Biome lint found issues. Fix them or run: pnpm run lint:fix"
  exit 1
fi

echo "✅ Lint passed."
EOF

chmod +x "$HOOKS_DIR/pre-commit"
echo "✅ Git pre-commit hook installed."
