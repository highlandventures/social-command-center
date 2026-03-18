/**
 * Structured logger — thin wrapper around console.
 * JSON output in production, pretty in development.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   const log = logger('cron/poll-metrics');
 *   log.info('Polled accounts', { count: 5 });
 *   log.error('Fetch failed', { error: err });
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const LEVEL_PRIORITY = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = process.env.LOG_LEVEL || 'debug';

function shouldLog(level) {
  return (LEVEL_PRIORITY[level] ?? 0) >= (LEVEL_PRIORITY[MIN_LEVEL] ?? 0);
}

function formatEntry(entry) {
  if (IS_PRODUCTION) {
    return JSON.stringify(entry);
  }
  const { level, module, message, timestamp, requestId, ...rest } = entry;
  const tag = level.toUpperCase().padEnd(5);
  const rid = requestId ? ` [${requestId}]` : '';
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  return `${timestamp} ${tag} [${module}]${rid} ${message}${extra}`;
}

function emit(level, entry) {
  const formatted = formatEntry(entry);
  switch (level) {
    case 'debug': console.debug(formatted); break;
    case 'info':  console.info(formatted);  break;
    case 'warn':  console.warn(formatted);  break;
    case 'error': console.error(formatted); break;
  }
}

/**
 * @param {string} module
 * @param {Record<string, unknown>} [defaultContext]
 */
export function logger(module, defaultContext) {
  function log(level, message, meta) {
    if (!shouldLog(level)) return;
    const entry = {
      level,
      module,
      message,
      timestamp: new Date().toISOString(),
      ...defaultContext,
      ...meta,
    };
    if (meta?.error instanceof Error) {
      entry.error = {
        name: meta.error.name,
        message: meta.error.message,
        stack: IS_PRODUCTION ? undefined : meta.error.stack,
      };
    }
    emit(level, entry);
  }

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info:  (msg, meta) => log('info', msg, meta),
    warn:  (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    child(context) {
      return logger(module, { ...defaultContext, ...context });
    },
  };
}
