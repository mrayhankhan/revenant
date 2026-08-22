/**
 * Plain ESM rather than TypeScript.
 *
 * `apps/web/package.json` declares no `"type"`, so TypeScript treats every `.ts`
 * file here as CommonJS, and the repo's `verbatimModuleSyntax` then rejects
 * `import`/`export` in the config. A `.mjs` config is unambiguous and needs no
 * compiler settings relaxed to accommodate it.
 *
 * @type {import('next').NextConfig}
 */
const config = {
  reactStrictMode: true,

  /*
   * Trace the committed snapshot into the serverless bundle.
   *
   * Nothing imports `data/demo.db` — it is opened by path at runtime — so Next
   * cannot infer it from the module graph and would otherwise ship functions
   * that connect to a database which is not there.
   */
  outputFileTracingIncludes: {
    '/api/**': ['data/demo.db'],
    '/': ['data/demo.db'],
  },
};

export default config;
