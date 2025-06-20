import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/lambda.ts"],
  format: ["cjs"], // Use CommonJS format for Lambda compatibility
  target: "node18", // Use node18 target for Lambda
  platform: "node",
  outDir: "dist",
  clean: false, // Don't clean since we might have other built files
  sourcemap: true,
  minify: false, // Disable minification for debugging
  bundle: true,
  splitting: false,
  treeshake: true,
  outExtension({ format }) {
    return {
      js: '.js' // Use .js extension for CommonJS
    }
  },
  external: [
    // AWS SDK is available in Lambda runtime
    "aws-sdk",
    "@aws-sdk/*"
  ],
  noExternal: [
    // Bundle these specific dependencies
    "express",
    "serverless-http",
    "@modelcontextprotocol/sdk",
    "dotenv",
    "yargs",
    "js-yaml",
    "remeda",
    "zod",
    "@figma/rest-api-spec"
  ]
});
