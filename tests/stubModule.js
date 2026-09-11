const path = require("path");
const Module = require("module");

/**
 * Pre-populates require.cache for a given absolute-resolved path so that
 * any subsequent `require(thatPath)` anywhere in the process returns our
 * fake instead of executing the real (mongoose-dependent) file.
 */
function stubModule(relativePathFromProjectRoot, exportsValue) {
  const absolute = path.resolve(__dirname, "..", relativePathFromProjectRoot);
  const resolved = require.resolve(absolute);
  const fakeModule = new Module(resolved, null);
  fakeModule.filename = resolved;
  fakeModule.loaded = true;
  fakeModule.exports = exportsValue;
  require.cache[resolved] = fakeModule;
}

module.exports = { stubModule };
