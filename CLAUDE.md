# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

BoombasticTracker is a fitness tracker. As of now the repository contains no application code yet — just this
documentation, a `.gitignore` tuned for .NET projects, and two empty planning folders:

- `Specs/FitnessTracker/Architecture` — intended location for architecture documentation/specs
- `Specs/FitnessTracker/Database hosting` — intended location for database hosting documentation/specs

Both folders are currently empty (git does not track empty directories, so they won't show up in `git status`).

The `.gitignore` is the standard GitHub template for .NET projects (`bin/`, `obj/`, `*.nupkg`, `TestResult.xml`,
etc.), which signals the intended stack is .NET/C#, but no `.sln`, `.csproj`, or source files exist yet.

## Guidelines

Refer to the files in `docs/` for project guidelines:

- [01-general-guidelines.md](docs/01-general-guidelines.md) — general coding style guidelines.

## Working in this repo

Since there is no code, no build/test/lint tooling, and no established architecture yet:

- Don't assume a project structure, framework version, or commands — check what actually exists before acting.
- If asked to scaffold the project, look for content added to the `Specs/` folders first, since that's where
  architecture and database hosting decisions are meant to live.
- Once real projects are added, this file should be updated with actual build/test/run commands and an
  architecture overview.
