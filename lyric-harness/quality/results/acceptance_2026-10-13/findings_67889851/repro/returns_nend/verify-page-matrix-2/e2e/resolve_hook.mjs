// Resolve bare specifiers that fail inside a tree without mcp/node_modules
// (wt-base) against the main checkout's installed mcp/node_modules. Scratch only.
const FALLBACK = 'file:///home/user/CodexMusica/mcp/package.json';
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (e) {
    if (/^[.\/]|^file:|^node:/.test(specifier)) throw e;
    return next(specifier, { ...context, parentURL: FALLBACK });
  }
}
