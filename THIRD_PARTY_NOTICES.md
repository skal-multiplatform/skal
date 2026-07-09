# Third-party notices

Skal's native runtime (`libskal`) embeds third-party software. This file
lists the major components, their licenses, and where Skal's
modifications live. Skal's own code is licensed under [Apache-2.0](LICENSE).

## Embedded in libskal

| Component | License | Source |
|---|---|---|
| **bun** (JavaScript runtime) | MIT | upstream [oven-sh/bun](https://github.com/oven-sh/bun); Skal's modifications are published as commits on the `skal` branch of [skal-multiplatform/bun](https://github.com/skal-multiplatform/bun), pinned in `patches/bun-skal-commit.txt` |
| **WebKit / JavaScriptCore** (JS engine) | LGPL-2.1-or-later and BSD-2-Clause (per-file; see WebKit source headers) | upstream [oven-sh/WebKit](https://github.com/oven-sh/WebKit) (bun's WebKit fork); Skal's modifications are published as commits on the `skal` branch of [skal-multiplatform/WebKit](https://github.com/skal-multiplatform/WebKit), pinned in `patches/webkit-skal-commit.txt` |
| **ICU** (Unicode / i18n, Android builds) | Unicode License (ICU) | built from source by `scripts/build-icu-android.sh` |

### LGPL compliance (JavaScriptCore)

Portions of WebKit/JavaScriptCore are licensed under the GNU Lesser
General Public License v2.1 or later. In compliance:

- The **complete corresponding source** of the JavaScriptCore build that
  Skal links — including all Skal modifications — is publicly available at
  <https://github.com/skal-multiplatform/WebKit> (branch `skal`, at the
  commit pinned in `patches/webkit-skal-commit.txt`).
- `libskal` is distributed as a **dynamically loadable library**
  (`libskal.dylib` / `libskal.so`), so applications and end users can
  replace it — including with a build linking a modified
  JavaScriptCore — without relinking the application. Build scripts to
  reproduce `libskal` from source ship in this repository (`scripts/`).

## Bundled by bun

bun itself vendors additional components that are compiled into
`libskal` via bun, including (non-exhaustive): mimalloc (MIT), zstd
(BSD-3), lol-html (BSD-3), c-ares (MIT), libarchive (BSD-2), BoringSSL
(OpenSSL/ISC), libuv-derived code (MIT), picohttpparser (MIT), SQLite
(public domain), libdeflate (MIT), tinycc (LGPL-2.1), zlib (zlib).
See the license files in the bun source tree
(<https://github.com/skal-multiplatform/bun>, branch `skal`) for the
complete, authoritative list.

## Framework dependencies (not embedded in libskal)

| Component | License | Used by |
|---|---|---|
| **SolidJS** | MIT | `skal` JS framework (peer/runtime dependency) |
| **Flutter** (framework + engine) | BSD-3-Clause | `skal_flutter` host rendering |
| **Dart SDK** | BSD-3-Clause | codegen + host tooling |

Applications built with Skal additionally inherit the licenses of the
Flutter plugins and npm packages they choose to depend on.
