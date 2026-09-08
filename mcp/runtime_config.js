import { readFileSync } from 'node:fs';
// Public effective settings only. Never serialize environment variables wholesale.
import { CHAT_LIMITS } from './chat.js';
import { LIMITS, DEFAULT_MODEL } from './gemini_agent.js';
import { TOOL_BUDGET_MS } from './budget.js';
import { TRUSTED_PROXY_HOPS } from './ratelimit.js';

export function effectiveConfiguration(env = process.env) {
  return {
    version: 1,
    model: env.GEMINI_MODEL || DEFAULT_MODEL,
    proposerModel: env.LYRIC_PROPOSER_MODEL || env.GEMINI_MODEL || DEFAULT_MODEL,
    dailyUsd: CHAT_LIMITS.dailyUsd,
    dailyTurns: CHAT_LIMITS.maxTurnsPerDay,
    maxTurnUsd: LIMITS.maxTurnUsd,
    maxTurnMs: LIMITS.maxTurnMs,
    toolBudgetMs: TOOL_BUDGET_MS,
    maxMessageChars: CHAT_LIMITS.maxMessageChars,
    maxTurns: CHAT_LIMITS.maxTurns,
    trustedProxyHops: TRUSTED_PROXY_HOPS,
  };
}

// Migration-only parser; remove with the legacy Blueprint after service transition.
export function expectedRenderConfig(yaml) {
  const pins = Object.fromEntries(
    [...yaml.matchAll(/^\s*- key:\s*(\w+)\s*\n\s*value:\s*([^\n#]+)$/gm)].map((m) => [
      m[1],
      m[2].trim().replace(/^['"]|['"]$/g, ''),
    ])
  );
  return expectedPins(pins);
}

// Desired settings are independent of the deployment provider's legacy format.
export function expectedProductionConfig() {
  const config = JSON.parse(
    readFileSync(new URL('./production-config.json', import.meta.url), 'utf8')
  );
  if (config.version !== 1) throw new Error('Unsupported production configuration version');
  return expectedPins(config.environment);
}

function expectedPins(pins) {
  const required = [
    'GEMINI_MODEL',
    'LYRIC_PROPOSER_MODEL',
    'CHAT_DAILY_USD',
    'CHAT_MAX_TURN_USD',
    'CHAT_TOOL_TIMEOUT_MS',
    'CHAT_MAX_MESSAGE',
    'TRUSTED_PROXY_HOPS',
  ];
  for (const key of required)
    if (!pins[key]) throw new Error(`Production configuration lacks required pin ${key}`);
  if (pins.CHAT_MAX_TURNS_PER_DAY)
    throw new Error('Production daily turn count must derive from the dollar budget');
  return {
    version: 1,
    model: pins.GEMINI_MODEL,
    proposerModel: pins.LYRIC_PROPOSER_MODEL,
    dailyUsd: Number(pins.CHAT_DAILY_USD),
    dailyTurns: Math.ceil((Number(pins.CHAT_DAILY_USD) / 0.01) * 2),
    maxTurnUsd: Number(pins.CHAT_MAX_TURN_USD),
    maxTurnMs: LIMITS.maxTurnMs,
    toolBudgetMs: Number(pins.CHAT_TOOL_TIMEOUT_MS),
    maxMessageChars: Number(pins.CHAT_MAX_MESSAGE),
    maxTurns: Number(pins.CHAT_MAX_TURNS || 50),
    trustedProxyHops: Number(pins.TRUSTED_PROXY_HOPS),
  };
}

export function configDrift(expected, live) {
  return Object.entries(expected).flatMap(([key, value]) =>
    live?.[key] === value
      ? []
      : [
          {
            tool: '/ready',
            what: `configuration.${key}: expected ${JSON.stringify(value)}, received ${JSON.stringify(live?.[key] ?? null)}`,
          },
        ]
  );
}
