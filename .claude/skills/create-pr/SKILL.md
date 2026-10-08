---
name: 'create-pr'
description: 'Open a pull request for the current branch into main: run the quality gate, the end-to-end tests and the Worker limits check, commit and push what is left, and create the PR with a descriptive title. Use only when asked to create or open a PR.'
argument-hint: 'Optional: a title to use instead of a generated one'
user-invocable: true
disable-model-invocation: true
---

# Create a pull request

Merging into `main` is deploying, so nothing is pushed until every check below has passed. Stop at
the first failure, report the failing lines, and leave the fix to the user.

## 1. Branch

Run `git status --short --branch`. On `main`, stop and ask for a branch name; never push to `main`.

## 2. Checks

Run these in order, one at a time, and require exit code 0 from each:

    pwsh -NoProfile -File scripts/check.ps1     # format + lint + typecheck + unit and storage tests
    pwsh -NoProfile -File scripts/e2e.ps1       # Playwright end-to-end tests
    pwsh -NoProfile -File scripts/bundle.ps1    # OpenNext build against the Worker limits

`bundle.ps1` builds the Worker and checks the two limits that can fail a deploy after the gate has
passed:

- **Size**: 64 MiB uncompressed, on the free and paid plans alike. There is no compressed limit.
- **Startup**: the Worker's top-level code must run within 1 second, so a large bundle can fail to
  deploy before it reaches the size limit.

Its startup time is measured on this machine, not on Cloudflare, so a result close to the limit
deserves a mention in the final message even when it passes. The limits are recorded in
[004-hosting-and-persistence.md](../../../docs/architecture/004-hosting-and-persistence.md).

## 3. Commit

Stage the remaining changes by path, never with `git add -A` or `git add .`. Leave out working
notes that do not belong in the repository: plan, spec, brainstorm, handover and session-notes
Markdown files, wherever they are, including `docs/superpowers/`. Documentation under `docs/` that
describes the app, such as an ADR or a guideline, is committed. Name anything left out in the final
message rather than deleting it.

Write one commit for what is left, in the style of `git log`: an imperative subject under 72
characters, then a body that says why. Skip the commit when nothing is left to stage.

## 4. Push and open

    git push -u origin HEAD

If `gh pr view` finds an open PR for the branch, the push has updated it; report its URL and stop.
Otherwise:

    gh pr create --base main --title "<title>" --body-file <file>

The body file holds only the `BUNDLE:` line from `bundle.ps1`, a blank line, and
`🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Write it to the scratchpad, not
the repository, and do not write a description.

The title describes what the branch changes for the app, in the imperative and under 70 characters,
drawn from `git log main..HEAD` and `git diff main...HEAD --stat` rather than from the branch name.
An argument passed to the skill replaces it.

Finish with the PR URL and anything that was left uncommitted.
