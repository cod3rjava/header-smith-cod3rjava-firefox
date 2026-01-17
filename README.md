## HeaderSmith – cod3rjava

A minimal **Firefox WebExtension** that lets you define request header overrides (name/value) from a popup UI and applies them to outgoing requests.

### Features
- Add multiple header overrides (enable/disable each one)
- Optional URL filter (regex) to only apply to matching URLs
- Persists settings in `storage.local`

### Install (Temporary, for development)
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `manifest.json` inside this folder

### Notes / Limitations
- Some headers may be restricted by Firefox / the WebExtension platform (e.g., certain sensitive headers). If a header can’t be changed, Firefox may ignore it.
- This extension modifies **request headers** only.

