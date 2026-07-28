#!/usr/bin/env bash
# Publish local StyleGrab history + tags + GitHub Releases in one shot.
# Run:  bash scripts/publish.sh
# Idempotent and reusable: pushes main, pushes every local tag, and creates a
# GitHub Release for any tag that doesn't have one yet (notes from CHANGELOG.md).
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE="https://github.com/AmigoUK/StyleGrab.git"

# 1. Ensure the origin remote exists.
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REMOTE"
fi

# 2. Reconcile with the remote (first run merges GitHub's auto-init stub;
#    later runs are a no-op / fast-forward). Keep our files on any conflict.
git pull origin main --allow-unrelated-histories --no-rebase -X ours --no-edit || true

# 3. Push branch + all tags.
git push origin main
git push origin --tags

# 4. Create a GitHub Release for every tag that lacks one.
notes_for() {
  awk -v s="## [$1]" '
    index($0,s)==1 { p=1; next }
    p==1 && (/^## \[/ || /^\[[^]]*\]: /) { exit }
    p
  ' CHANGELOG.md
}

for t in $(git tag --sort=version:refname); do
  if gh release view "$t" >/dev/null 2>&1; then
    echo "Release $t already exists — skipping."
  else
    body="$(notes_for "${t#v}")"
    [ -z "$body" ] && body="See CHANGELOG.md ($t)."
    gh release create "$t" --title "$t" --notes "$body"
    echo "Created release $t."
  fi
done

echo
echo "Done. main + tags pushed; releases up to date."
git --no-pager log --oneline -5
