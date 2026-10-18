module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo automatically adds the Reanimated/Worklets plugin,
    // so it must not be listed again here.
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
