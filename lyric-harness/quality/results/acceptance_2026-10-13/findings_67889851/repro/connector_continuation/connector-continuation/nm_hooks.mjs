// Resolve hook: a bare package specifier that does not resolve from its parent
// (wt-base has no node_modules) is retried as if imported from wt-678/mcp,
// whose node_modules is the shared /home/user/CodexMusica/mcp/node_modules.
const FALLBACK = 'file:///tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-678/mcp/__fallback__.js';
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    const bare = !/^(\.|\/|file:|node:|data:)/.test(specifier);
    if (bare && error.code === 'ERR_MODULE_NOT_FOUND')
      return next(specifier, { ...context, parentURL: FALLBACK });
    throw error;
  }
}
