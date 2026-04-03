# Publishing secrets (maintainers only)

Optional **automated** upload to stores uses [.github/workflows/release.yml](../.github/workflows/release.yml).

## Repository variables

| Variable | Purpose |
|----------|---------|
| `CHROME_PUBLISH_ENABLED` | Set to `true` to run the Chrome Web Store job after a tag push |
| `FIREFOX_PUBLISH_ENABLED` | Set to `true` to run the Firefox Add-ons job after a tag push |

## GitHub secrets

### Chrome Web Store (`publish-chrome-web-store` job)

| Secret | Description |
|--------|-------------|
| `CHROME_EXTENSION_ID` | Published extension ID |
| `CHROME_CLIENT_ID` | OAuth client ID from Google Cloud / Chrome Web Store API |
| `CHROME_CLIENT_SECRET` | OAuth client secret |
| `CHROME_REFRESH_TOKEN` | Refresh token for the upload API |

### Firefox Add-ons (`publish-firefox-addons` job)

| Secret | Description |
|--------|-------------|
| `FIREFOX_EXTENSION_UUID` | Add-on UUID (if required by the action) |
| `FIREFOX_API_KEY` | AMO API key |
| `FIREFOX_API_SECRET` | AMO API secret |

## Manual alternative

If secrets are not configured, download the **release ZIP artifacts** from GitHub Releases (created by the same workflow) and upload manually to each store console.

## GitHub Pages (privacy policy)

No secrets required. Enable **Pages → GitHub Actions** in repository settings; [.github/workflows/pages.yml](../.github/workflows/pages.yml) deploys [docs/store-assets/privacy/index.html](store-assets/privacy/index.html).
