# Rendering Troubleshooting

## Canvas Rendering Issues

If you're experiencing rendering issues such as:
- Bidirectional flows not displaying correctly
- Clipping not working as expected
- Visual artifacts in flow rendering

### Bidirectional Flow Rendering

**Update:** The bidirectional flow rendering has been updated to use filled polygons instead of nested canvas clipping. This approach works reliably across all platforms, including macOS with hardware acceleration enabled.

The previous implementation used nested `clip()` calls which don't work correctly on some platforms. The new implementation:
- Draws each half of a bidirectional flow as a filled polygon
- Calculates the offset points along the Bezier curve
- Creates a smooth fill from the centerline to the outer edge
- Works consistently across all browsers and platforms

## Canvas Context Options

The game uses the following canvas context options to optimize rendering:
- `alpha: true` - Supports transparency
- `desynchronized: false` - Ensures proper synchronization (better for clipping)
- `willReadFrequently: false` - Optimized for write-heavy operations

## Legacy Issues (Resolved)

### Nested Clipping with Hardware Acceleration (Fixed)

Earlier versions used nested `clip()` calls for bidirectional flow rendering, which caused issues on some GPU drivers, particularly on macOS. This has been resolved by switching to a filled polygon approach that works reliably on all platforms.

If you're using an older version and experiencing clipping issues, you can force software rendering:

**Chrome:**
```bash
chrome --use-gl=swiftshader
# or
chrome --disable-gpu
```

**Via Chrome Settings:**
- Go to `chrome://settings`
- Search for "hardware acceleration"
- Disable "Use hardware acceleration when available"
- Restart Chrome

**Firefox:**
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

## Testing

The e2e tests use Playwright's browser automation which provides consistent rendering across test runs. The new filled polygon approach ensures that interactive browsing produces the same visual results as automated tests.

