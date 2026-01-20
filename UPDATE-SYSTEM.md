# Update System Overview

## How It Works

| Context | Check | “Update” behavior |
|--------|-------|-------------------|
| **Dev (git clone)** | GitHub Releases API | `git fetch` → `git checkout` tag → `npm install` → `npm run build` → restart. Only runs if `.git` exists. |
| **Packaged app (DMG, etc.)** | Same API | No in-app install. Modal: “Download the latest version from GitHub” → **Open Releases Page** opens the releases URL in the browser. User downloads the new DMG and reinstalls. |

**Version source (in order):** `version.json` (written at build from git tag) → `git describe` → `package.json` → `"0.1.0"`.

---

## Is This OK?

**Yes, for most cases.** “Check for updates → open GitHub Releases → user downloads and reinstalls” is a common and acceptable pattern for:

- Internal or small-team tools
- Apps where updates are occasional
- Audiences that can handle a manual download

### Limitations

1. **No one-click update in the packaged app** – User must go to GitHub, find the right file (e.g. DMG), and reinstall.
2. **Full reinstall every time** – No deltas; acceptable for a small app.
3. **Depends on release discipline** – Each GitHub release should include the correct installer asset (e.g. `Vivaro-Installer.dmg`).

---

## Alternatives (If You Outgrow It)

### 1. Neutralino built-in updater (`Neutralino.updater`)

- **What it does:** Fetches a manifest (JSON with `version`, `resourcesURL`), downloads a new `resources.neu`, and replaces it. Restart to apply.
- **Catch:** It only replaces `resources.neu` (Neutralino + frontend). It does **not** update `server.js`, `version.json`, or server `node_modules`.
- **Fit for Vivaro:** Only safe if a release **never** changes server code or server dependencies. If you do, you’d need a separate “full reinstall” flow when server changes.
- **Extra work:** Host a manifest and `resources.neu` (or equivalent) per release (e.g. from GitHub Releases), and add `updater.*` to `nativeAllowList`.

### 2. neutralino-autoupdate (third‑party)

- Targets **full app updates** (binaries, installers, checksums).
- Would require integrating the library and aligning your release artifacts (e.g. DMG) with what it expects.
- Better if you want something closer to “download installer and run” from inside the app.

### 3. Custom “download and open installer”

- Server (or Neutralino) calls GitHub Releases API, finds the asset for the current OS (e.g. DMG), downloads it, then runs `open /path/to/file.dmg` (macOS).
- **Needs:** Stable asset names, error handling, and handling of `~/Downloads` or temp dirs. Doable, more code than opening the releases page.

### 4. Electron / Tauri

- Mature auto-update (e.g. electron-updater, Tauri’s updater) with download + apply + restart.
- Implies a non-trivial migration; only worth it if auto-updates become a top priority.

---

## Recommended Practices

1. **Release checklist**
   - Tag: `release--YYYY.MM.DD.NN` (or your convention).
   - Create GitHub Release from that tag.
   - Attach `Vivaro-Installer.dmg` (and any other installers) to the release.
   - Asset names should stay consistent so you can automate later if needed.

2. **/releases/latest**
   - Use `https://github.com/DBNubs/vivaro/releases/latest` so “Open Releases Page” goes straight to the newest release.

3. **Download modal copy**
   - Briefly mention what to download, e.g.:
     “Download **Vivaro-Installer.dmg** from the Assets section and open it to install.”

4. **Optional: direct download link**
   - Add an API that returns the `browser_download_url` for the current OS (e.g. Mac DMG) from the latest release’s assets.
   - Add a “Download for macOS” (or “Download installer”) button that opens that URL. Requires consistent asset naming in every release.

---

## Summary

- **Current design is fine** to ship: clear UX, works for dev and packaged app, and avoids fragile, server-touching auto-updates that don’t fit your stack.
- **Quick wins:** Point to `/releases/latest` and sharpen the download modal text.
- **Next step up:** Direct “Download for Mac” using release assets, if you want to reduce one click.
- **Bigger changes:** Neutralino.updater only if you can guarantee frontend-only updates; neutralino-autoupdate or custom “download + open DMG” if you need in-app, full-app updates.
