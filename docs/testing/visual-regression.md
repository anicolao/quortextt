# Visual Regression Testing

Quortex keeps visual regression baselines separate from narrative user-story
screenshots.

## Required pull-request checks

`npm run test:e2e` builds the production frontend and backend, runs Playwright,
and compares the curated snapshots in `tests/e2e/snapshots/`. Snapshot failures
produce expected, actual, and diff images under `test-results/` and fail at the
assertion that changed.

CI uses the explicit update modes for both Playwright snapshots and narrative
screenshots, then runs `git diff` across every tracked visual expectation. This
additional check is byte-exact: a PNG fails CI even when its decoded pixels are
identical but its compression or metadata bytes differ.

Baselines are separated by Playwright project and operating-system platform.
The required GitHub check uses the Linux baselines. A zero-pixel threshold is
used for the required Chromium snapshots; animations, carets, viewport size,
fonts, and browser launch options are controlled by `playwright.config.ts`.

To intentionally update snapshots for the current platform:

```bash
npm run test:e2e -- --update-snapshots
git diff -- tests/e2e/snapshots/
```

Review actual and diff images before committing an updated baseline.

## Narrative user-story screenshots

Normal local E2E runs do not rewrite the documentation images in
`tests/e2e/user-stories/`. Regenerate them only when the documented flow should
change:

```bash
npm run test:e2e:stories
npm run test:e2e:stories -- tests/e2e/configuration.spec.ts
```

The second form limits regeneration to one story. Review every resulting PNG
diff as documentation, not as a Playwright assertion baseline.

## Scheduled browser and responsive matrix

The `Scheduled browser matrix` GitHub Actions workflow runs every Monday and on
manual dispatch. It exercises the compiled tabletop build with desktop Firefox,
desktop WebKit, and a touch-enabled mobile Chromium viewport. This matrix is
informational rather than a required pull-request check while its coverage is
stabilized.

Run the same smoke matrix locally after installing all three Playwright browser
binaries:

```bash
npx playwright install chromium firefox webkit
npm run test:e2e:matrix
```
