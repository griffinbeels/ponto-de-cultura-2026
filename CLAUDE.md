# CBLA Ponto de Cultura site

Live at https://cblapontodecultura.org: a Cloudflare Worker (`cblapontodecultura`) that serves static
assets only, so requests are free and unlimited. The older GitHub Pages copy
(griffinbeels.github.io/ponto-de-cultura-2026) updates when `main` is pushed.

Griffin's loop (2026-09-25): feedback, change, live immediately. After each change: commit,
`npm run deploy`, then `git push`, then check the live page. Deploy publishes the latest commit, never
the working tree, and only the paths in `SITE` in tools/deploy.mjs (index.html, styles.css, app.js,
assets/); a new public top-level file must be added there. `npm run deploy -- --dry-run` checks without
publishing; `npx wrangler rollback` restores the previous version.

Wrangler auth: `npx wrangler login` (browser consent, 2-minute window). Other Cloudflare changes
(DNS, analytics, settings) go through the `cloudflare` MCP server (https://mcp.cloudflare.com/mcp).
