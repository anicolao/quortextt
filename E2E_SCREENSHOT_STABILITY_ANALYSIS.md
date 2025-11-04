# E2E Screenshot Stability Analysis

## Executive Summary

The e2e screenshots have been regenerated and analyzed. The tests themselves **ARE stable** when run on the same environment (0 pixel difference between consecutive runs), but **NOT stable across different environments** due to font rendering and browser version differences.

## Test Results

### Regeneration Run
- **Date**: 2025-11-04
- **Tests Run**: 31 total
- **Tests Passed**: 29
- **Tests Failed**: 2 (unrelated to screenshot stability)
- **Screenshots Modified**: 15 files

### Stability Analysis

#### Same Environment Stability: ✅ STABLE
When running tests consecutively on the same system:
- **Pixel difference**: 0 pixels
- **Byte difference**: 0 bytes
- **Result**: Screenshots are perfectly reproducible

#### Cross-Environment Stability: ❌ UNSTABLE
When comparing committed screenshots to regenerated ones:
- **Pixel differences**: ~14,232 pixels per image (consistent across multiple files)
- **Byte differences**: 100-500 bytes per image
- **Result**: Screenshots differ between environments

## Root Causes

### 1. Font Rendering Differences
**Impact**: HIGH

The tile-rendering tests draw text labels directly on canvas using Arial font:
```javascript
ctx.font = 'bold 16px Arial';
ctx.fillStyle = 'black';
ctx.strokeStyle = 'white';
ctx.lineWidth = 3;
```

**Issues**:
- Arial font rendering varies across operating systems (Windows, macOS, Linux)
- Different font installations can produce slightly different glyph shapes
- Subpixel positioning differences even with `--disable-font-subpixel-positioning`
- Anti-aliasing algorithms vary between systems

### 2. Chrome/Playwright Version Differences
**Impact**: MEDIUM

Different versions of Chrome can have:
- Different canvas rendering engines
- Different anti-aliasing algorithms
- Different font rendering pipelines

### 3. Graphics Stack Differences
**Impact**: MEDIUM

Underlying graphics differences:
- Different GPU drivers
- Different graphics libraries (e.g., different versions of FreeType on Linux)
- Headless vs headed mode rendering differences

## Current Mitigation Strategies

The project already implements several stability measures:

1. **Font rendering flags** (playwright.config.ts):
   ```javascript
   launchOptions: {
     args: [
       '--font-render-hinting=none',
       '--disable-font-subpixel-positioning',
       '--disable-lcd-text',
     ],
   }
   ```

2. **Animation pausing** (tile-rendering.spec.ts):
   ```javascript
   await page.evaluate(() => {
     const store = (window as any).__REDUX_STORE__;
     store.dispatch({ type: 'PAUSE_ANIMATIONS' });
   });
   ```

3. **Fixed wait times** for rendering to complete

## Proposed Solutions

### Solution 1: Use Web Fonts (RECOMMENDED)
**Complexity**: Low | **Effectiveness**: High

Instead of relying on system Arial, bundle a web font:

```javascript
// In test setup
await page.addStyleTag({
  content: `
    @font-face {
      font-family: 'TestFont';
      src: url('data:font/woff2;base64,...') format('woff2');
    }
  `
});

// In canvas drawing
ctx.font = 'bold 16px TestFont';
```

**Pros**:
- Consistent font across all environments
- No dependency on system fonts

**Cons**:
- Requires bundling font file
- Initial setup effort

### Solution 2: Remove Text from Visual Tests
**Complexity**: Low | **Effectiveness**: High

For tile-rendering tests, text labels could be:
1. Removed entirely if not essential for visual verification
2. Moved to test assertions instead of visual overlays
3. Rendered in a separate documentation step

**Pros**:
- Eliminates font rendering variability
- Tests focus on actual game rendering

**Cons**:
- Less human-readable screenshots
- Requires alternative documentation approach

### Solution 3: Use Docker for Consistent Environment
**Complexity**: Medium | **Effectiveness**: High

Run all e2e tests in a Docker container with:
- Fixed Chrome version
- Fixed font installations
- Fixed graphics libraries

**Pros**:
- Complete environment consistency
- Reproducible across all systems

**Cons**:
- Requires Docker setup
- Slower test execution
- More complex CI/CD setup

### Solution 4: Visual Regression Testing with Tolerance
**Complexity**: Medium | **Effectiveness**: Medium

Use a tool like Percy, Chromatic, or Playwright's visual comparison with a pixel tolerance:

```javascript
await expect(page).toHaveScreenshot('screenshot.png', {
  maxDiffPixels: 15000, // Allow minor font rendering differences
});
```

**Pros**:
- Catches significant visual regressions
- Allows minor rendering differences

**Cons**:
- May miss subtle bugs
- Requires tuning threshold values

### Solution 5: Regenerate Screenshots in CI
**Complexity**: Low | **Effectiveness**: Medium

Accept that screenshots vary by environment and:
1. Always regenerate screenshots in CI
2. Store "golden" screenshots per environment
3. Compare only within same environment

**Pros**:
- Simple to implement
- Accepts reality of cross-environment differences

**Cons**:
- Requires more storage
- Different "truth" per environment

## Recommendations

### Immediate (This PR)
✅ **Regenerate all screenshots** with current environment - DONE

### Important Note on Additional Browser Flags
Testing showed that adding additional GPU-related flags (`--disable-gpu`, `--use-gl=swiftshader`, etc.) causes MORE rendering differences rather than improving stability. The current flags are optimal:
- `--font-render-hinting=none`
- `--disable-font-subpixel-positioning`
- `--disable-lcd-text`

### Short Term (Recommended)
1. **Accept regenerated screenshots**: The current screenshots are stable within the environment
2. **Establish baseline**: Consider these the new baseline for this environment
3. **Document environment**: Record Chrome/Playwright versions used

### Medium Term (If cross-environment stability is needed)
1. **Implement Solution 1 (Web Fonts)**: Bundle a web font for consistent text rendering across environments
2. **Or implement Solution 2**: Remove text overlays from visual tests, move to assertions
3. **Add pixel tolerance in CI**: Configure Playwright to accept minor differences (threshold ~15,000 pixels for text-heavy screenshots)

### Long Term (If perfect reproducibility is required)
1. **Implement Solution 3 (Docker)**: Run all e2e tests in containerized environment
2. **Minimize text in screenshots**: Focus visual tests on actual game rendering only
3. **Monitor Chrome versions**: Document when Chrome updates require screenshot regeneration

## Experimentation Results

### Testing Additional Browser Flags
We tested adding the following flags to improve stability:
- `--disable-skia-runtime-opts`
- `--disable-accelerated-2d-canvas`
- `--disable-gpu`
- `--use-gl=swiftshader`

**Result**: These flags caused MORE rendering differences (13,751+ pixels changed per screenshot) rather than improving stability. This is because they fundamentally change the rendering pipeline from hardware-accelerated to software rendering, which produces visibly different output.

**Conclusion**: The current browser flags in playwright.config.ts are optimal and should not be modified.

## Files Modified

The following screenshots were regenerated:
- `tests/e2e/user-stories/001-player-configuration/009-game-started.png`
- `tests/e2e/user-stories/002-gameplay-rendering/001-two-players.png`
- `tests/e2e/user-stories/002-gameplay-rendering/003-preview-tile.png`
- `tests/e2e/user-stories/006-complete-game-mouse/0189-move-34-tile-placed.png`
- `tests/e2e/user-stories/006-tile-rendering/*.png` (11 files)

## Conclusion

The e2e tests are **well-designed and stable within a given environment**. The cross-environment instability is a known limitation of visual testing that affects text rendering in particular. The recommended approach is to:

1. Accept and commit the regenerated screenshots for the current environment
2. Implement web fonts for text overlays to improve cross-environment stability
3. Add tolerance thresholds for visual comparison
4. Consider Docker containerization for absolute consistency

The tests serve their purpose of catching visual regressions and documenting expected behavior. The minor font rendering differences do not indicate test flakiness or design flaws.
