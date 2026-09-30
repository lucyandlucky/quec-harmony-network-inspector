# Quec Network Inspector

Desktop network inspector for HarmonyOS apps that use `quec_network_v2`.

## Run

Requires Node.js and DevEco Studio (or an `hdc` executable on `PATH`). Connect a HarmonyOS device or start an emulator, then run:

```sh
cd /Users/lucy/Download/QuecNetworkInspector
npm install
npm run icons
npm start
```

The renderer uses React, TypeScript and Vite. `npm start` type-checks and builds both Electron and the renderer before launching. For live renderer development, use `npm run dev`; `npm run typecheck` and `npm test` check the TypeScript source, protocol behavior and renderer interactions.

The app selects the first available device automatically. Requests appear as soon as they start. Select one to inspect its headers, bodies, status and duration, or copy a cURL command. The package filter separates events from apps that include the inspector reporter.

For a macOS app bundle, run `npm run pack:mac`. The result is under `dist/mac*/Quec Network Inspector.app`.

Set `HDC_PATH` if DevEco Studio is installed in a nonstandard location. Set `QNI_DEVTOOLS=1` to open Electron DevTools while developing.

## Scope

The inspector reads structured HiLog events emitted by `quec_network_v2` with tag `QuecInspector`. Other HTTP clients and third-party apps do not appear unless they emit the same protocol. Request headers and bodies are shown without redaction. Binary and multipart bodies are visible in the details when available, but cURL export is disabled because a text command would not replay them accurately. HiLog can drop events under heavy logging; incomplete events are ignored.
