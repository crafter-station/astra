import type { NextConfig } from "next";

// `.wgsl` files import as `ShaderSource` objects through @vgpu/wgsl's loader.
// Turbopack (the default) reads `turbopack.rules`; `next build --webpack`
// reads the `webpack()` hook. Both are wired so either bundler works.
const config: NextConfig = {
  turbopack: {
    rules: {
      "*.wgsl": {
        loaders: ["@vgpu/wgsl/loader-webpack"],
        as: "*.js",
      },
    },
  },
  webpack(webpackConfig) {
    webpackConfig.module ??= {};
    webpackConfig.module.rules ??= [];
    webpackConfig.module.rules.push({
      test: /\.wgsl$/,
      loader: "@vgpu/wgsl/loader-webpack",
      options: { minify: true },
    });
    return webpackConfig;
  },
};

export default config;
