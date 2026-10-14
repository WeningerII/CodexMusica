// Resolve hook (BB8 verify): a bare package specifier that fails to resolve
// from its importer (wt-base and wt-main/mcp have no node_modules, and this
// scratch dir has none) is resolved again as if imported from wt-678/mcp.
const FALLBACK = 'file:///tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-678/mcp/__x__.js';
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND' && !/^(\.|\/|file:|node:|data:)/.test(spec))
      return next(spec, { ...ctx, parentURL: FALLBACK });
    throw e;
  }
}
