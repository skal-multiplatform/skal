// Skal plugin shim — geolocation.
//
// Single async API that resolves to a position object regardless of
// target. The implementation is target-specific:
//
//   - Web: calls `navigator.geolocation` DIRECTLY.
//
//     It used to route through the B.5 hidden Flutter Web plugin host
//     (`plugin-bridge-web.js` → `__skalPluginCall` → Dart runs
//     `package:geolocator` → `geolocator_web` → `navigator.geolocation`).
//     Read that chain backwards: it boots most of a Flutter Web runtime
//     to reach a browser API the page already has, for a call that
//     returns one small object. The plugin host earns its keep for
//     capabilities the browser genuinely lacks; this is not one.
//
//     `callPlugin` remains the fallback for a browser without the API
//     (or a non-DOM host), so nothing that worked stops working.
//   - Native (eventual): routes through the (future) native plugin
//     bridge to the same `package:geolocator` Dart API — which there
//     hits CoreLocation / FusedLocationProvider directly.
//
// Today only the web path is implemented. The native path is a no-op
// stub that throws; it will be filled in when the native plugin-
// bridge protocol lands (TODO_PLATFORMS.md §2).
//
// Usage from a Skal app:
//
//   import { getCurrentPosition } from 'skal-plugin-geolocator';
//   const pos = await getCurrentPosition();
//   // → { lat, lon, accuracy, altitude, speed, timestamp }

import { callPlugin } from 'skal/plugin-bridge-web';

/**
 * Request the device's current position. Triggers a browser permission
 * prompt on first call (or rejects with a "denied" error if the user
 * declined previously). Resolves to:
 *
 *   { lat, lon, accuracy, altitude, speed, timestamp }
 *
 * @returns {Promise<{lat: number, lon: number, accuracy: number, altitude: number, speed: number, timestamp: number}>}
 */
export async function getCurrentPosition(options) {
  const geo = (typeof navigator !== 'undefined') ? navigator.geolocation : null;
  if (!geo || typeof geo.getCurrentPosition !== 'function') {
    // No browser API — fall back to the plugin host.
    return callPlugin('geolocator.getCurrentPosition', {});
  }
  return new Promise((resolve, reject) => {
    geo.getCurrentPosition(
      (pos) => {
        const c = pos.coords || {};
        resolve({
          lat: c.latitude,
          lon: c.longitude,
          accuracy: c.accuracy,
          // The browser reports null where no fix is available; the
          // documented shape is numeric, so normalize rather than leak
          // nulls into app code that does arithmetic on them.
          altitude: c.altitude ?? 0,
          speed: c.speed ?? 0,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        // PERMISSION_DENIED === 1. Preserve the "denied" wording the
        // plugin-host path rejects with, so callers can keep matching
        // on it across both paths.
        const denied = err && err.code === 1;
        reject(new Error(denied
          ? 'geolocation denied'
          : `geolocation failed: ${(err && err.message) || 'unknown'}`));
      },
      options,
    );
  });
}
