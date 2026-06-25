import mysql from 'mysql2/promise';
import { URL } from 'url';

const dbUrl = process.env.DATABASE_URL || 'mysql://imvelo_user:imvelo_secure_password@localhost:3306/imvelo_shift_db';

let pool: mysql.Pool;

try {
  let config: mysql.PoolOptions;
  if (dbUrl.startsWith('mysql://') || dbUrl.startsWith('mysqls://')) {
    const parsed = new URL(dbUrl);
    config = {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: decodeURIComponent(parsed.pathname.substring(1)),
      waitForConnections: true,
      connectionLimit: 30,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    };
  } else {
    config = {
      uri: dbUrl,
      waitForConnections: true,
      connectionLimit: 30,
      queueLimit: 0,
    } as any;
  }

  pool = mysql.createPool(config);
} catch (error) {
  console.error('[MySQL] Failed to parse DATABASE_URL, attempting fallback config:', error);
  pool = mysql.createPool({
    host: 'localhost',
    user: 'imvelo_user',
    password: 'imvelo_secure_password',
    database: 'imvelo_shift_db',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 30,
    queueLimit: 0
  });
}

let isDbConnected = false;

export function useMySQL(): boolean {
  return isDbConnected;
}

export { pool };

// Execute query helper
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const [results] = await pool.execute(sql, params);
  return results as T;
}

// Transaction execution helper
export async function transaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Auto-create swap review tables if they don't exist
export async function initTables() {
  try {
    // Probe database connectivity
    const connection = await pool.getConnection();
    connection.release();
    isDbConnected = true;
    console.log('[MySQL] Connection pool verified successfully.');

    // Initialize ScheduleResolutionService Cache
    try {
      const { ScheduleResolutionService } = await import('../services/ScheduleResolutionService');
      await ScheduleResolutionService.initCache();
    } catch (cacheErr) {
      console.error('[MySQL] Failed to initialize ScheduleResolutionService Cache:', cacheErr);
    }

    console.log('[MySQL] Ensuring multi-level review tables exist...');
    
    await query(`
      CREATE TABLE IF NOT EXISTS swap_review_requests (
        id VARCHAR(50) PRIMARY KEY,
        swap_request_id VARCHAR(50) NOT NULL,
        volunteer_user_id VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        approvals_required INT NOT NULL DEFAULT 2,
        approvals_received INT NOT NULL DEFAULT 0,
        rejections_received INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        finalized_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (swap_request_id) REFERENCES swap_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (volunteer_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS swap_review_assignments (
        id VARCHAR(50) PRIMARY KEY,
        review_request_id VARCHAR(50) NOT NULL,
        reviewer_user_id VARCHAR(50) NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (review_request_id) REFERENCES swap_review_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewer_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS swap_review_decisions (
        id VARCHAR(50) PRIMARY KEY,
        review_request_id VARCHAR(50) NOT NULL,
        reviewer_user_id VARCHAR(50) NOT NULL,
        decision VARCHAR(50) NOT NULL,
        comments TEXT NULL,
        decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (review_request_id) REFERENCES swap_review_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewer_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY idx_review_reviewer (review_request_id, reviewer_user_id)
      )
    `);

    // Ensure messages table has is_read_by column
    try {
      await query('ALTER TABLE messages ADD COLUMN is_read_by TEXT NULL');
      console.log('[MySQL] Added is_read_by column to messages table.');
    } catch (columnErr) {
      // Column might already exist, which is fine
    }

    console.log('[MySQL] Multi-level review tables checked/created successfully.');
  } catch (err) {
    console.error('[MySQL] Error initializing tables:', err);
  }
}

// Trigger async initialization
initTables().catch(e => console.error('[MySQL] Init tables failed:', e));
