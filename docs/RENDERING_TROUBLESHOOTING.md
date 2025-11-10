# Rendering Troubleshooting

## Canvas Rendering Issues

If you're experiencing rendering issues such as:
- Bidirectional flows not displaying correctly
- Clipping not working as expected
- Visual artifacts in flow rendering

You may be experiencing a hardware acceleration issue with canvas rendering.

## Forcing Software Rendering

### Chrome/Chromium

To force Chrome to use software rendering (SwiftShader), you can:

1. **Via Command Line:**
   ```bash
   # Linux/Mac
   chromium --disable-gpu --disable-software-rasterizer
   
   # Or specifically force SwiftShader
   chromium --use-gl=swiftshader
   
   # Windows
   chrome.exe --disable-gpu --disable-software-rasterizer
   ```

2. **Via Chrome Flags:**
   - Navigate to `chrome://flags`
   - Search for "Override software rendering list"
   - Enable it
   - Restart Chrome

3. **Via Chrome Settings:**
   - Go to `chrome://settings`
   - Search for "hardware acceleration"
   - Disable "Use hardware acceleration when available"
   - Restart Chrome

### Firefox

To disable hardware acceleration in Firefox:
1. Go to `about:preferences`
2. Scroll to "Performance"
3. Uncheck "Use recommended performance settings"
4. Uncheck "Use hardware acceleration when available"
5. Restart Firefox

## Verifying Rendering Mode

To check if you're using software rendering:
1. Navigate to `chrome://gpu` (Chrome) or `about:support` (Firefox)
2. Look for "Graphics Feature Status"
3. Check if features are listed as "Software only" or "Hardware accelerated"

## Canvas Context Options

The game uses the following canvas context options to optimize rendering:
- `alpha: true` - Supports transparency
- `desynchronized: false` - Ensures proper synchronization (better for clipping)
- `willReadFrequently: false` - Optimized for write-heavy operations

## Known Issues

### Nested Clipping with Hardware Acceleration

Some GPU drivers may not correctly handle nested `clip()` calls in canvas 2D context. This affects:
- Bidirectional flow rendering (uses two clip regions)
- Flow rendering at tile boundaries (uses hexagon clipping)

**Workaround:** Force software rendering using the methods above.

## Testing

The e2e tests use Playwright's browser automation which may use different rendering paths than interactive browsing. If rendering works in tests but not interactively, it's likely a hardware acceleration issue.
