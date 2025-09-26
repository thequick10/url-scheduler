import { getDbPool } from '../db.js';

/**
 * Creates a new scheduled job in the database.
 *
 * @param {object} jobDetails - The details of the job.
 * @param {number} jobDetails.userId - The ID of the user who owns the job.
 * @param {string} jobDetails.fileName - The name of the uploaded file.
 * @param {string} jobDetails.mimeType - The MIME type of the file.
 * @param {Buffer} jobDetails.fileContent - The content of the file.
 * @param {string} jobDetails.scheduledAt - The ISO 8601 string for when the job should run.
 * @returns {Promise<number>} The ID of the newly created job.
 */
export async function createScheduledJob({ userId, fileName, mimeType, fileContent, scheduledAt }) {
  const pool = getDbPool();
  const [result] = await pool.query(
    'INSERT INTO scheduled_jobs (user_id, file_name, mime_type, file_content, scheduled_at) VALUES (?, ?, ?, ?, ?)',
    [userId, fileName, mimeType, fileContent, scheduledAt]
  );
  return result.insertId;
}

/**
 * Fetches all jobs with a 'pending' status that are due to be run.
 *
 * @returns {Promise<Array<object>>} A list of pending jobs.
 */
export async function getPendingJobs() {
  const pool = getDbPool();
  const [rows] = await pool.query('SELECT * FROM scheduled_jobs WHERE status = \'pending\' AND scheduled_at <= NOW() ORDER BY scheduled_at ASC');
  return rows;
}

/**
 * Updates the status of a scheduled job.
 *
 * @param {object} details - The job update details.
 * @param {number} details.jobId - The ID of the job to update.
 * @param {'pending'|'processing'|'completed'|'failed'} details.status - The new status.
 * @returns {Promise<void>}
 */
export async function updateJobStatus({ jobId, status }) {
  const pool = getDbPool();
  await pool.query('UPDATE scheduled_jobs SET status = ? WHERE id = ?', [status, jobId]);
}

/**
 * Creates a new scheduled result in the database.
 *
 * @param {object} resultDetails - The details of the result.
 * @param {number} resultDetails.jobId - The ID of the parent job.
 * @param {string} resultDetails.originalUrl - The original URL from the file.
 * @param {string} [resultDetails.finalUrl] - The resolved final URL.
 * @param {string} [resultDetails.country] - The country used for resolution.
 * @param {string} [resultDetails.uaType] - The user agent type used.
 * @param {string} [resultDetails.notes] - Any notes from the file.
 * @param {'resolved'|'failed'} resultDetails.status - The resolution status.
 * @param {string} [resultDetails.errorMessage] - Any error message.
 * @returns {Promise<number>} The ID of the newly created result.
 */
export async function createScheduledResult({ jobId, originalUrl, finalUrl, country, uaType, notes, status, errorMessage }) {
  const pool = getDbPool();
  const [result] = await pool.query(
    'INSERT INTO scheduled_results (job_id, original_url, final_url, country, uaType, notes, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [jobId, originalUrl, finalUrl, country, uaType, notes, status, errorMessage]
  );
  return result.insertId;
}

/**
 * Lists all scheduled jobs for a specific user.
 *
 * @param {object} details - The user details.
 * @param {number} details.userId - The ID of the user.
 * @returns {Promise<Array<object>>} A list of jobs.
 */
export async function listScheduledJobsForUser({ userId }) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    'SELECT id, file_name, status, scheduled_at, created_at FROM scheduled_jobs WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

/**
 * Lists all scheduled results for a specific user.
 *
 * @param {object} details - The user details.
 * @param {number} details.userId - The ID of the user.
 * @returns {Promise<Array<object>>} A list of results.
 */
export async function getScheduledResults({ userId }) {
  const pool = getDbPool();
  const [rows] = await pool.query(
    `SELECT r.* 
     FROM scheduled_results r
     JOIN scheduled_jobs j ON r.job_id = j.id
     WHERE j.user_id = ? 
     ORDER BY r.resolved_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Updates a single scheduled result.
 *
 * @param {object} details - The result update details.
 * @param {number} details.resultId - The ID of the result to update.
 * @param {string} details.finalUrl - The new final URL.
 * @param {'resolved'|'failed'} details.status - The new status.
 * @returns {Promise<void>}
 */
export async function updateScheduledResult({ resultId, finalUrl, status }) {
  const pool = getDbPool();
  await pool.query(
    'UPDATE scheduled_results SET final_url = ?, status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
    [finalUrl, status, resultId]
  );
}

/**
 * Deletes all scheduled results for a specific user.
 *
 * @param {object} details - The user details.
 * @param {number} details.userId - The ID of the user.
 * @returns {Promise<void>}
 */
export async function deleteAllScheduledResults({ userId }) {
  const pool = getDbPool();
  // First, delete results associated with jobs of this user
  await pool.query(
    `DELETE sr FROM scheduled_results sr
     JOIN scheduled_jobs sj ON sr.job_id = sj.id
     WHERE sj.user_id = ?`,
    [userId]
  );
}

/**
 * Deletes a specific scheduled job.
 *
 * @param {object} details - The job details.
 * @param {number} details.jobId - The ID of the job to delete.
 * @param {number} details.userId - The ID of the user who owns the job (for security).
 * @returns {Promise<void>}
 */
export async function deleteScheduledJob({ jobId, userId }) {
  const pool = getDbPool();
  // Delete associated results first due to foreign key constraint
  await pool.query('DELETE FROM scheduled_results WHERE job_id = ?', [jobId]);
  // Then delete the job itself
  await pool.query('DELETE FROM scheduled_jobs WHERE id = ? AND user_id = ?', [jobId, userId]);
}
