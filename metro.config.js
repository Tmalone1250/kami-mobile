const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Privy's js-sdk-core imports `jose` from an ESM context, so Metro picks jose's
// "import" export condition (the Node build, which needs `crypto`). Force the
// browser build, which uses WebCrypto and works in React Native.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "jose") {
    return {
      type: "sourceFile",
      filePath: path.resolve(
        __dirname,
        "node_modules/jose/dist/browser/index.js"
      ),
    };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(
    context,
    moduleName,
    platform
  );
};

module.exports = withNativeWind(config, { input: "./global.css" });
