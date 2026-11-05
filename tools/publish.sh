#!/usr/bin/env bash
# publish.sh - export the committed workspace to the public repo (main) and the noindex Pages preview (gh-pages).
#   KEYS_DIR=<folder outside the project holding fal.key> bash tools/publish.sh "<commit message>"
# The Higgsfield key is scanned from the HF_KEY environment variable (no key file). Never pushes the workspace repo
# itself. Every gate runs BEFORE anything is pushed: build, link check (fails on a broken link), preview build (fails
# on an unprefixed reference), secret scan and residue scan of BOTH public copies (all fail closed).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_URL="https://github.com/SGEN-Sites/buzzy-redesign.git"
PREFIX="/buzzy-redesign"
KEYS="${KEYS_DIR:?set KEYS_DIR to the folder holding fal.key (outside the project)}"
[ -n "${HF_KEY:-}" ] || { echo "HF_KEY is not set: cannot scan for the Higgsfield key"; exit 1; }
SCAN=(--keys "$KEYS/fal.key" --env-key HF_KEY)
# neither public copy may name the site whose architecture was adopted, nor an earlier client; the list stays in tmp/
RESIDUE=(--patterns tmp/residue.json)
MSG="${1:-Update}"
GIT_NAME="$(git log -1 --format=%an)"; GIT_EMAIL="$(git log -1 --format=%ae)"
TRAILER=$'\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'

[ -z "$(git status --porcelain)" ] || { echo "workspace not clean: commit first"; exit 1; }

# ---- 1. build + link check (gate) ----
MSYS_NO_PATHCONV=1 node src/build.mjs
node tools/link-check.mjs --dir dist > tmp/link-check.log 2>&1 || { tail -30 tmp/link-check.log; echo "link check failed"; exit 1; }
grep -E "^files|broken" tmp/link-check.log | head -3 || true

# ---- 2. both public copies, built and scanned before any push ----
mkdir -p publish/repo
if [ ! -d publish/repo/.git ]; then git -C publish/repo init -q -b main; git -C publish/repo remote add origin "$REPO_URL"; fi
find publish/repo -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
git archive HEAD | tar -x -C publish/repo
MSYS_NO_PATHCONV=1 node tools/make-pages-preview.mjs --prefix "$PREFIX" --out preview
for d in publish/repo preview; do
  node tools/secret-scan.mjs --dir "$d" "${SCAN[@]}"
  node tools/residue-scan.mjs --dir "$d" "${RESIDUE[@]}"
done

# ---- 3. push ----
git -C publish/repo add -A
git -C publish/repo -c user.name="$GIT_NAME" -c user.email="$GIT_EMAIL" commit -q -m "$MSG$TRAILER" || echo "repo: nothing to commit"
git -C publish/repo push -q -u origin main
if [ ! -d preview/.git ]; then git -C preview init -q -b gh-pages; git -C preview remote add origin "$REPO_URL"; fi
git -C preview add -A
git -C preview -c user.name="$GIT_NAME" -c user.email="$GIT_EMAIL" commit -q -m "Preview: $MSG$TRAILER" || echo "preview: nothing to commit"
git -C preview push -q -u origin gh-pages
echo "published: repo $(git -C publish/repo rev-parse --short HEAD), preview $(git -C preview rev-parse --short HEAD)"
