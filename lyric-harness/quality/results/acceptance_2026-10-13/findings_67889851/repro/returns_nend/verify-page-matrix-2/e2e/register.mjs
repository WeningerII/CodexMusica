import { register } from 'node:module';
register(new URL('./resolve_hook.mjs', import.meta.url).href);
