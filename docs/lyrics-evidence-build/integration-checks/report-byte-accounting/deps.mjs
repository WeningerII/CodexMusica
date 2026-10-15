import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        error.code !== 'ERR_MODULE_NOT_FOUND' ||
        specifier.startsWith('.') ||
        specifier.startsWith('/') ||
        specifier.startsWith('node:')
      )
        throw error;
      return nextResolve(specifier, {
        ...context,
        parentURL: 'file:///workspace/musica-ci/mcp/dependency-proxy.mjs',
      });
    }
  },
});
