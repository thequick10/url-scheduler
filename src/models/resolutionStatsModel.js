import { getDbPool } from '../db.js';

/**
 * Updates the resolution statistics for a given region.
 *
 * @param {object} details - The details for the update.
 * @param {string} details.region - The region code (e.g., 'US', 'GB').
 * @param {boolean} details.isSuccess - True if the resolution was successful, false otherwise.
 */
export async function updateResolutionStats({ region, isSuccess }) {
  const pool = getDbPool();
  const columnToIncrement = isSuccess ? 'success_count' : 'failure_count';

  await pool.query(
    `INSERT INTO resolution_stats (region, ${columnToIncrement}) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE ${columnToIncrement} = ${columnToIncrement} + 1, last_updated = CURRENT_TIMESTAMP`,
    [region]
  );
}

/**
 * Retrieves all resolution statistics.
 *
 * @returns {Promise<Array<object>>} A list of all resolution stats per region.
 */
export async function getResolutionStats() {
  const pool = getDbPool();
  const [rows] = await pool.query('SELECT region, success_count, failure_count FROM resolution_stats');
  return rows;
}

/**
 * Resets all resolution statistics.
 */
export async function resetResolutionStats() {
  const pool = getDbPool();
  await pool.query('TRUNCATE TABLE resolution_stats');
}
