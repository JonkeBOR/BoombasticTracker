# Handover — testing foundation + Playwright MCP

Disposable file. Delete it once the work below is finished.

Branch `chore/setup-testing`. **Everything is implemented and verified except one step.**
Nothing is committed yet.

## The one remaining task

Confirm the Playwright MCP actually connects, then:

1. Run the app.
2. Open the landing page at http://localhost:3000.
3. Take a screenshot.
4. Present the screenshot.

That is the whole ask. The previous session could not do step 1 because the MCP server was
configured _during_ that session, and Claude Code only loads `.mcp.json` at session start.

## Start here

On session start you should be prompted to approve the `playwright` MCP server, or it should
connect automatically via `.claude/settings.json` (`enabledMcpjsonServers: ["playwright"]`).

Verify the MCP tools are present (`browser_navigate`, `browser_snapshot`,
`browser_take_screenshot`). Then:

    npm run dev          # background; the MCP does NOT start the app itself

Then `browser_navigate` to http://localhost:3000 and `browser_take_screenshot`.

Expect the viewport to be iPhone 17 under WebKit — `.mcp.json` passes `--browser=webkit --mobile`.

### If the MCP still does not connect

Do not spend long on it. Playwright is installed and proven working, so take the screenshot
directly with `@playwright/test` / `playwright` against a running dev server and report that the
MCP path is still unverified. Do not claim the MCP works unless its tools actually ran.

### Likely first-run snag

`@playwright/mcp@0.0.80` pins its own `playwright-core` build, which may differ from
`@playwright/test@1.63.0`. It may ask for its own browser download on first launch. Run whatever
command it prints; the two builds coexist and cost disk, not correctness.

## What is already done — do not redo any of this

- **Skills**: `.claude/skills/{run-app,check,test}/SKILL.md`
- **Vitest**: `vitest.config.mts`, `src/app/page.test.tsx` (colocated convention)
- **Playwright**: `playwright.config.ts`, `e2e/home.spec.ts`, WebKit only, `iPhone 17` profile
- **Scripts**: `scripts/test.ps1`, `scripts/e2e.ps1`; `test.ps1` added as a stage in `check.ps1`
- **MCP**: `.mcp.json` (pinned `@playwright/mcp@0.0.80`), `.claude/settings.json`
- **Docs**: `docs/02-tooling-and-scripts.md` deleted, `CLAUDE.md` trimmed 6186 -> 5112 bytes,
  `README.md` updated, `docs/architecture/002-testing-strategy.md` added, constitution bumped
  to 1.2.0

## Verified green (re-verify only if you change something)

    pwsh -NoProfile -File scripts/check.ps1     # exit 0: FORMAT/LINT/TYPECHECK/TEST all PASS
    pwsh -NoProfile -File scripts/e2e.ps1       # exit 0: tests=1 passed=1
    npm run build                               # exit 0; route table shows only "/"

Failure paths were proven, not assumed: a broken assertion gives `TEST: FAIL` + exit 1 with the
failing line; hiding the WebKit directory gives exit 2 with the install instruction.

## Five places reality differed from the original plan

Worth knowing so you do not "fix" them back:

1. **Vitest 5's JSON reporter writes to a file, not stdout.** `test.ps1` passes an explicit temp
   `--outputFile` and reads it. A stdout parse silently fails.
2. **`vite-tsconfig-paths` was dropped.** Vite 8 resolves tsconfig paths natively via
   `resolve.tsconfigPaths: true`. The plugin earns nothing now.
3. **No ESLint override block was needed.** All new files pass `recommendedTypeChecked` and
   `react/jsx-no-literals` untouched. Do not add a blanket test-file override pre-emptively.
4. **Device is `iPhone 17`, not `iPhone 15`** — it is what the MCP's `--mobile` emulates, so the
   E2E project and the MCP browser share one viewport.
5. **`engines.node` is now `>=22.12`** (Vitest 5 / Vite 8 require it). `>=20.11` became false.

## Open decisions

- **Not committed.** Review the diff first; commit when happy.
- **No CI**, deliberately — hosting is still undecided, per the constitution's deferral list.
