#!/usr/bin/env bash
# Records the working tree when Claude ends a turn, and reports what changed
# since then when the user sends a message: edits made outside Claude.
# Uses its own git index in the git directory, so the real index and history
# are untouched. Asked of git: in a worktree .git is a file, not a directory.
set -euo pipefail
cd "$CLAUDE_PROJECT_DIR"
dir="$(git rev-parse --absolute-git-dir)/claude-snapshot"
mkdir -p "$dir"
snapshot() { GIT_INDEX_FILE="$dir/index" git add -A && GIT_INDEX_FILE="$dir/index" git write-tree; }
case "${1:-}" in
  snapshot) snapshot > "$dir/last" ;;
  report)
    [ -f "$dir/last" ] || exit 0
    old=$(cat "$dir/last"); new=$(snapshot)
    [ "$old" = "$new" ] && exit 0
    mapfile -d '' changed < <(git diff -z --name-only "$old" "$new")
    # A file that now matches the last commit was changed by a commit, rebase
    # or pull, not by hand (a message sent during Claude's turn sees Claude's
    # own git work too). Without a commit there is nothing to compare with.
    if git rev-parse -q --verify HEAD >/dev/null; then
      mapfile -d '' changed < <(git diff -z --name-only HEAD "$new" -- "${changed[@]}")
    fi
    [ "${#changed[@]}" -eq 0 ] && exit 0
    echo "Files the user changed since Claude's last turn (deliberate; build on them, don't revert):"
    git diff --stat "$old" "$new" -- "${changed[@]}"
    # Capped, so a large change can't flood the context; head closing the
    # pipe early is not an error.
    git diff "$old" "$new" -- "${changed[@]}" | head -c 20000 || true
    ;;
esac
