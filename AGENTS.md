# AGENTS.md

## Cursor Cloud specific instructions

This is a React (Create React App) single-page application with two features:
- **足球早盘 (Soccer Early Market Viewer)**: Fetches soccer league and match data from external API `https://ball.skybit.shop`. This is the default view rendered by `Ball.jsx`.
- **合约盈亏计算器 (Crypto Contract Calculator)**: Calculation utilities in `CalculationUtils.js`, `PositionHandlers.js`, with contract data in `ContractsData.json`.

### Key commands

See `package.json` scripts. Standard CRA commands:
- Dev server: `npm start` (port 3000)
- Build: `npm run build`
- Tests: `npm test` (or `CI=true npm test` for non-interactive)

### Notes

- Package manager: **npm** (lockfile is `package-lock.json`).
- The default test (`App.test.js`) is a stale CRA template test that looks for "learn react" text — it will fail because the app content differs. This is a pre-existing issue, not a setup problem.
- The soccer feature depends on the external API at `https://ball.skybit.shop`. If this API is unavailable, the league list will not load, but the app itself still starts normally.
- No backend, database, Docker, or environment variables are required.
