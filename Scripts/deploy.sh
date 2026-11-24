#!/bin/sh
set -eu
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

die() { printf '%s\n' "$*" >&2; exit 1; }
root=$(CDPATH= cd -P "$(dirname "$0")/.." && pwd)
cd "$root"
[ -d public ] || die "Missing public/ publishing checkout."
public=$(CDPATH= cd -P public && pwd)
[ "$public" = "$root/public" ] || die "public/ must not be a symlink to another checkout."
[ -e "$public/.git" ] &&
  [ "$(git -C "$public" rev-parse --show-toplevel)" = "$public" ] ||
  die "public/ must be its own Git checkout."
[ "$(git -C "$public" symbolic-ref --quiet HEAD)" = refs/heads/master ] ||
  die "Switch public/ to its master branch before deploying."
[ -z "$(git -C "$public" status --porcelain --untracked-files=all)" ] ||
  die "public/ has uncommitted files; review them before deploying."

git -C "$public" fetch --no-tags --no-recurse-submodules origin refs/heads/master
upstream=$(git -C "$public" rev-parse --verify FETCH_HEAD)
git -C "$public" merge-base --is-ancestor HEAD "$upstream" ||
  die "public/master has unpublished or diverged commits; reconcile them before deploying."
git -C "$public" merge --ff-only "$upstream"

# Build from scratch and overlay only the generated files. This intentionally
# keeps published files not managed by this build (e.g. app support pages).
scratch=$(mktemp -d "${TMPDIR:-/tmp}/hugo-deploy.XXXXXXXX")
trap 'rm -rf "$scratch"' 0
trap 'exit 1' HUP INT TERM
hugo --destination "$scratch/site"
[ -f "$scratch/site/index.html" ] || die "Hugo did not produce index.html; nothing deployed."
[ -z "$(find "$scratch/site" -name .git -prune -o -type l -print)" ] ||
  die "Generated output contains symlinks; nothing deployed."
(
  cd "$scratch/site"
  find . -name .git -prune -o -type f -print0
) > "$scratch/paths"

[ "$(git -C "$public" rev-parse HEAD)" = "$upstream" ] &&
  [ -z "$(git -C "$public" status --porcelain --untracked-files=all)" ] ||
  die "public/ changed while building; nothing copied or staged."
rsync -a --exclude='.git' "$scratch/site/" "$public/"
git -C "$public" --literal-pathspecs add   --pathspec-from-file="$scratch/paths" --pathspec-file-nul
[ -z "$(git -C "$public" diff --cached --no-renames --name-only --diff-filter=D)" ] ||
  die "Generated output would remove published files; review the staged diff."
if git -C "$public" diff --cached --quiet; then
  printf '%s\n' "No generated changes to publish."
  exit 0
fi
git -C "$public" commit -m "Update"
git -C "$public" push --no-follow-tags origin HEAD:refs/heads/master ||
  die "Push rejected; local deploy commit preserved. Fetch and reconcile before retrying."
