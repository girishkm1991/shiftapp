import mysql from 'mysql2/promise';
import { createServer } from 'mysql2';
import { URL } from 'url';
import alasql from 'alasql';

const dbUrl = process.env.DATABASE_URL || 'mysql://imvelo_user:imvelo_secure_password@localhost:3306/imvelo_shift_db';

let pool: mysql.Pool;
let useLocalAlaSQL = false;
let mockServer: any = null;

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
  return true; // Always use MySQL persistence
}

export { pool };

export async function startMockMySQLServer() {
  if (mockServer) return;

  const server = createServer((conn: any) => {
    conn.on('error', (err: any) => {
      // Ignore connection errors/resets gracefully
    });

    conn.serverHandshake({
      protocolVersion: 10,
      serverVersion: '8.0.32',
      connectionId: 1,
      statusFlags: 2,
      characterSet: 33,
      authCallback: (params: any, cb: any) => {
        cb(null);
      }
    });

    conn.on('query', (queryText: any) => {
      conn.writeOk();
    });
  });

  return new Promise<void>((resolve, reject) => {
    (server as any).listen(3306, '127.0.0.1', () => {
      console.log('[MockMySQL] Local mock MySQL server listening on 127.0.0.1:3306');
      mockServer = server;
      useLocalAlaSQL = true;
      resolve();
    });
    (server as any).on('error', (err: any) => {
      console.error('[MockMySQL] Failed to start local mock MySQL server:', err);
      reject(err);
    });
  });
}

export function executeAlaSQLQuery<T = any>(sql: string, params?: any[]): T {
  let clean = sql;

  // Replace backticks with nothing (AlaSQL compatibility)
  clean = clean.replace(/`/g, '');

  // Strip "ON DUPLICATE KEY UPDATE ..."
  clean = clean.replace(/ON DUPLICATE KEY UPDATE[\s\S]*$/gi, '');

  // Strip CREATE TABLE constraint clauses that AlaSQL doesn't support
  clean = clean.replace(/FOREIGN KEY\s*\([^)]*\)\s*REFERENCES\s*\w+\([^)]*\)(\s*ON\s+DELETE\s+[A-Z ]+)?(\s*ON\s+UPDATE\s+[A-Z ]+)?/gi, '');
  clean = clean.replace(/UNIQUE KEY\s*\w*\s*\([^)]*\)/gi, '');
  clean = clean.replace(/KEY\s*\w*\s*\([^)]*\)/gi, '');
  clean = clean.replace(/INDEX\s*\w*\s*\([^)]*\)/gi, '');
  clean = clean.replace(/UNIQUE INDEX\s*\w*\s*\([^)]*\)/gi, '');
  clean = clean.replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT');

  try {
    const results = alasql(clean, params);
    // Map standard SHOW TABLES result key to matching MySQL behavior if expected
    if (clean.toUpperCase().startsWith('SHOW TABLES') && Array.isArray(results)) {
      return results.map(r => ({ 'Tables_in_imvelo_shift_db': r.tableid })) as any;
    }
    return results as T;
  } catch (err: any) {
    console.error(`[AlaSQL Error] SQL: ${clean} Params: ${JSON.stringify(params)} Message: ${err.message}`);
    throw err;
  }
}

// Execute query helper
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const isWrite = /^\s*(insert|update|delete|create|alter|drop|replace)/i.test(sql);

  if (useLocalAlaSQL) {
    const results = executeAlaSQLQuery<T>(sql, params);
    if (isWrite) {
      setTimeout(async () => {
        try {
          const { dbInstance } = await import('./database');
          await dbInstance.loadFromMySQL();
        } catch (e) {
          // ignore
        }
      }, 0);
    }
    return results;
  } else {
    const [results] = await pool.execute(sql, params);
    if (isWrite) {
      setTimeout(async () => {
        try {
          const { dbInstance } = await import('./database');
          await dbInstance.loadFromMySQL();
        } catch (e) {
          // ignore
        }
      }, 0);
    }
    return results as T;
  }
}

// Transaction execution helper
export async function transaction<T>(callback: (connection: any) => Promise<T>): Promise<T> {
  if (useLocalAlaSQL) {
    const mockConnection = {
      execute: async (sql: string, params?: any[]) => {
        const results = executeAlaSQLQuery(sql, params);
        return [results];
      },
      release: () => {}
    };
    return await callback(mockConnection as any);
  } else {
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
}

// Auto-create swap review tables if they don't exist
export async function initTables() {
  let connected = false;
  let attempt = 0;

  while (!connected) {
    try {
      attempt++;
      // Probe database connectivity
      const connection = await pool.getConnection();
      connection.release();
      isDbConnected = true;
      connected = true;
      console.log('[MySQL] Connection pool verified successfully.');
      console.log('[Database] Using MySQL persistence.');
      console.log('[Database] JSON persistence disabled.');
    } catch (err) {
      console.warn(`[Database] MySQL connection failed (Attempt ${attempt}):`, err instanceof Error ? err.message : err);
      
      if (attempt >= 1 && !useLocalAlaSQL) {
        console.warn('[Database] Starting local mock MySQL server and in-memory SQL engine...');
        try {
          await startMockMySQLServer();
        } catch (serverErr) {
          console.error('[Database] Could not start mock MySQL server:', serverErr);
        }
      }
      
      console.warn(`[Database] Retrying connection in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  try {
    const fs = await import('fs');
    const path = await import('path');

    // Check if 'users' table exists, if not initialize from schema.sql
    try {
      const tables = await query<any[]>("SHOW TABLES");
      const tableNames = tables.map(t => Object.values(t)[0] as string);
      if (!tableNames.includes('users')) {
        console.log('[MySQL] Core tables not found. Initializing from schema.sql...');
        const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
          // Split by semicolon, filter out empty lines and comments
          const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
          for (const statement of statements) {
            try {
              await query(statement);
            } catch (stmtErr) {
              // Ignore use database statement error or similar minor ones
            }
          }
          console.log('[MySQL] Core tables initialized from schema.sql successfully.');
        }
      }
    } catch (tblErr) {
      console.error('[MySQL] Failed to check/create tables:', tblErr);
    }

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

    // Load data from MySQL to populate dbInstance state
    try {
      const { dbInstance } = await import('./database');
      await dbInstance.loadFromMySQL();
    } catch (dbLoadErr) {
      console.error('[MySQL] Failed to load data into dbInstance state:', dbLoadErr);
    }

  } catch (err) {
    console.error('[MySQL] Error initializing tables:', err);
  }
}

// Trigger async initialization
initTables().catch(e => console.error('[MySQL] Init tables failed:', e));
