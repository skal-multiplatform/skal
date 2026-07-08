// Skal plugin shim — geolocation.
//
// Single async API that resolves to a position object regardless of
// target. The implementation is target-specific:
//
//   - Web: routes through the B.5 hidden Flutter Web plugin host
//     (`plugin-bridge-web.js` → `__skalPluginCall` → Dart side runs
//     `package:geolocator` → which on web uses `geolocator_web` →
//     which calls `navigator.geolocation.getCurrentPosition`).
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
export async function getCurrentPosition() {
  return callPlugin('geolocator.getCurrentPosition', {});
}
