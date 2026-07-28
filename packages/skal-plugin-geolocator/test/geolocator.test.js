// The web path calls `navigator.geolocation` directly.
//
// It used to route through the B.5 Flutter Web plugin host: JS →
// `__skalPluginCall` → Dart → `package:geolocator` → `geolocator_web` →
// `navigator.geolocation`. Read backwards, that boots most of a Flutter
// Web runtime to reach an API the page already has.
//
// These pin the direct path, the fallback that keeps the old behaviour
// where the browser API is absent, and the error contract — callers
// match on "denied", and that has to mean the same thing on both paths.

import { test, expect, describe, beforeEach, afterEach } from 'bun:test';

let calls;

beforeEach(() => {
  calls = [];
  // Stand in for `skal/plugin-bridge-web`, which is what the fallback
  // reaches for. Recorded so a test can prove it was NOT used.
  // The host contract, learned the hard way and worth writing down: a
  // JSON STRING (callPlugin parses it) carrying an ENVELOPE
  // `{ ok, value }` (callPlugin unwraps it). A bare object fails with
  // "non-JSON"; a bare payload fails with "plugin failed". Both are the
  // bridge doing its job.
  globalThis.__skalPluginCall = (name, args) => {
    calls.push({ name, args });
    return Promise.resolve(JSON.stringify({
      ok: true,
      value: { lat: 0, lon: 0, via: 'plugin-host' },
    }));
  };
});

afterEach(() => {
  delete globalThis.navigator;
  delete globalThis.__skalPluginCall;
});

function fakeGeolocation(impl) {
  globalThis.navigator = { geolocation: { getCurrentPosition: impl } };
}

async function load() {
  // Fresh module each time so the import sees the current globals.
  const mod = await import(`../src/index.js?t=${calls.length}-${Math.random()}`);
  return mod;
}

describe('getCurrentPosition on web', () => {
  test('resolves from navigator.geolocation without touching the plugin host', async () => {
    fakeGeolocation((ok) => ok({
      coords: { latitude: 51.5, longitude: -0.12, accuracy: 8,
                altitude: 35, speed: 1.4 },
      timestamp: 1700000000000,
    }));

    const { getCurrentPosition } = await load();
    const pos = await getCurrentPosition();

    expect(pos).toEqual({
      lat: 51.5, lon: -0.12, accuracy: 8,
      altitude: 35, speed: 1.4, timestamp: 1700000000000,
    });
    expect(calls).toEqual([]);          // the whole point
  });

  test('null altitude/speed normalize to 0, not null', async () => {
    // Browsers report null where there is no fix. The documented shape
    // is numeric, and app code does arithmetic on these.
    fakeGeolocation((ok) => ok({
      coords: { latitude: 1, longitude: 2, accuracy: 3,
                altitude: null, speed: null },
      timestamp: 42,
    }));

    const { getCurrentPosition } = await load();
    const pos = await getCurrentPosition();
    expect(pos.altitude).toBe(0);
    expect(pos.speed).toBe(0);
  });

  test('a denied permission rejects with the same wording as the host path', async () => {
    fakeGeolocation((_ok, err) => err({ code: 1, message: 'User denied' }));
    const { getCurrentPosition } = await load();
    await expect(getCurrentPosition()).rejects.toThrow(/denied/);
  });

  test('a non-permission failure reports the browser message', async () => {
    fakeGeolocation((_ok, err) => err({ code: 2, message: 'position unavailable' }));
    const { getCurrentPosition } = await load();
    await expect(getCurrentPosition()).rejects.toThrow(/position unavailable/);
  });

  test('options are forwarded to the browser', async () => {
    let seen = null;
    fakeGeolocation((ok, _err, opts) => {
      seen = opts;
      ok({ coords: { latitude: 0, longitude: 0, accuracy: 0 }, timestamp: 0 });
    });
    const { getCurrentPosition } = await load();
    await getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
    expect(seen).toEqual({ enableHighAccuracy: true, timeout: 5000 });
  });

  test('falls back to the plugin host when the browser has no geolocation', async () => {
    // A non-DOM host, or a browser that withholds the API. Nothing that
    // worked before should stop working.
    globalThis.navigator = {};
    const { getCurrentPosition } = await load();
    const pos = await getCurrentPosition();
    expect(pos.via).toBe('plugin-host');
    expect(calls.length).toBe(1);
    expect(calls[0].name).toBe('geolocator.getCurrentPosition');
  });
});
