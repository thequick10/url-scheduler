// db-monthly-wipe.js
import cron from 'node-cron';
import 'dotenv/config';
import { getDbPool } from './src/db.js';

const TABLES_TO_WIPE = [
  'activity_logs',
  'resolution_stats',
  'scheduled_jobs',
  'scheduled_results',
  'sessions',
];

const TIMEZONE = process.env.WIPE_TIMEZONE || 'Asia/Kolkata';
const WIPE_ENABLED = String(process.env.DB_WIPE_ENABLED).toLowerCase() === 'true';
const DRY_RUN = String(process.env.WIPE_DRY_RUN).toLowerCase() === 'true';
const FORCE_WIPE = String(process.env.FORCE_WIPE).toLowerCase() === 'true';
// Optional: if set, only wipe this single table (helpful for iterative testing)
const WIPE_ONLY_TABLE = process.env.WIPE_ONLY_TABLE || '';

const DEFAULT_HOUR = 23;
const DEFAULT_MINUTE = 59;

function parseEnvInt(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const v = Number(raw);
  if (!Number.isInteger(v) || v < min || v > max) {
    console.warn(
      `[Monthly Wipe] Invalid ${name}="${raw}". Falling back to ${fallback}. Must be integer between ${min} and ${max}.`
    );
    return fallback;
  }
  return v;
}

const WIPE_HOUR = parseEnvInt('WIPE_HOUR', DEFAULT_HOUR, 0, 23);
const WIPE_MINUTE = parseEnvInt('WIPE_MINUTE', DEFAULT_MINUTE, 0, 59);

function getYMDInTimeZone(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function isLastDayOfMonth() {
  const { year, month, day } = getYMDInTimeZone(TIMEZONE);
  const lastDay = new Date(year, month, 0).getDate();
  return day === lastDay;
}

/**
 * Exported for manual testing/imports
 */
export async function performMonthlyWipe() {
  if (!WIPE_ENABLED) {
    console.log('[Monthly Wipe] Disabled (set DB_WIPE_ENABLED=true). Skipping.');
    return;
  }

  if (!isLastDayOfMonth() && !FORCE_WIPE) {
    console.log('[Monthly Wipe] Not the last day of the month. Skipping wipe.');
    return;
  }

  console.log(
    `[Monthly Wipe] Starting monthly database wipe (tz=${TIMEZONE}) at ${String(WIPE_HOUR).padStart(2, '0')}:${String(
      WIPE_MINUTE
    ).padStart(2, '0')} — DRY_RUN=${DRY_RUN} — FORCE_WIPE=${FORCE_WIPE}`
  );

  const pool = getDbPool();
  if (!pool || typeof pool.query !== 'function') {
    console.error('[Monthly Wipe] getDbPool() must return a pool with a .query(...) Promise API.');
    return;
  }

  // Decide which tables to run on (support WIPE_ONLY_TABLE override)
  const tables = WIPE_ONLY_TABLE ? [WIPE_ONLY_TABLE] : TABLES_TO_WIPE;

  try {
    console.log('[Monthly Wipe] Will process tables:', tables.join(', '));
    if (DRY_RUN) {
      console.log('[Monthly Wipe] DRY_RUN enabled — no truncation will be performed.');
      // Optionally, you can test DB connectivity by running a harmless query:
      await pool.query('SELECT 1');
      console.log('[Monthly Wipe] DB connectivity OK (dry-run).');
      return;
    }

    // Disable FK checks then truncate each table
    await pool.query('SET FOREIGN_KEY_CHECKS = 0;');

    for (const table of tables) {
      console.log(`[Monthly Wipe] Truncating ${table}...`);
      await pool.query(`TRUNCATE TABLE \`${table}\`;`);
      console.log(`[Monthly Wipe] Truncated ${table}.`);
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('[Monthly Wipe] Database wipe completed successfully.');
  } catch (err) {
    console.error('[Monthly Wipe] Error during database wipe:', err);
    try {
      await pool.query('SET FOREIGN_KEY_CHECKS = 1;');
    } catch (e) {
      console.error('[Monthly Wipe] Failed to re-enable FK checks:', e);
    }
  }
}

// Build cron expression
const cronExpr = `${WIPE_MINUTE} ${WIPE_HOUR} * * *`;

// Schedule job
cron.schedule(cronExpr, () => {
  // call but don't await in scheduler
  performMonthlyWipe().catch((err) => console.error('[Monthly Wipe] Scheduler error:', err));
}, { timezone: TIMEZONE });

console.log(
  `[Monthly Wipe] Scheduled to check daily at ${String(WIPE_HOUR).padStart(2, '0')}:${String(
    WIPE_MINUTE
  ).padStart(2, '0')} ${TIMEZONE}. (Will only truncate on the last day unless FORCE_WIPE=true)`
);

// Manual-run helper: RUN_NOW env triggers a single-run immediately (useful for testing)
if (String(process.env.RUN_NOW).toLowerCase() === 'true') {
  console.log('[Monthly Wipe] RUN_NOW=true — executing wipe now (manual test).');
  performMonthlyWipe().then(() => {
    console.log('[Monthly Wipe] Manual run finished.');
    // exit only if this was intended as a one-off test process
    if (process.env.EXIT_AFTER_RUN === 'true') process.exit(0);
  }).catch(err => {
    console.error('[Monthly Wipe] Manual run error:', err);
    if (process.env.EXIT_AFTER_RUN === 'true') process.exit(1);
  });
}

process.on('SIGINT', () => {
  console.log('[Monthly Wipe] Script stopped (SIGINT).');
  process.exit(0);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Monthly Wipe] Unhandled Rejection:', reason);
});
