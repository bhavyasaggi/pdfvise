import * as nodeModule from "node:module";

// registerHooks() drops CommonJS named exports (pdf-lib) on Node 24 when
// --experimental-strip-types is on. The async register() loader still works.
nodeModule.register("./resolve-ts.mjs", import.meta.url);
