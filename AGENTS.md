# Gouache Studio shared release workflow

Read `CLAUDE.md` for the project layout and build/test conventions. Its historical version notes are background, not the current release version.

Kenn uses Codex and Claude on this project. Official updates are changes merged into GitHub `main`, with a numbered Windows release produced by `.github/workflows/build.yml`. Keep both agents on that same release history:

- Before choosing a version or publishing, refresh `origin/main` and check the version on official `main` and the latest GitHub release. Also inspect the working files for another agent's pending version change. Never lower or reuse a released version, or publish an older working branch as the current app.
- Update all four version files together with `node scripts/bump.mjs X.Y.Z`: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and the app entry in `src-tauri/Cargo.lock`.
- Add every user-visible release change to a new top `## X.Y.Z` section in `CHANGELOG.md` and to `RELEASE_NOTES.md`. The build embeds `CHANGELOG.md` in **Help > What's new**; release notes appear in the updater. Preserve earlier release entries.
- Test the intended changes before merging. Publish only those changes against fresh official `main`; a shared folder may contain unrelated work or already-merged files. Preserve other agents' work. Do not switch or reset a shared working branch while another agent is actively editing it.
- Merge when the user has authorized it. Check the Windows build and the signed updater feed before saying the desktop update is available. A source merge alone is not an available installer.

Keep user-facing explanations plain and distinguish implemented, merged, building and released states.
