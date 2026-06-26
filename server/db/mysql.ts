import mysql from 'mysql2/promise';
import { URL } from 'url';

const dbUrl = process.env.DATABASE_URL || 'mysql://imvelo_user:imvelo_secure_password@mysql:3306/imvelo_shift_db';

let pool: mysql.Pool;

function parseDatabaseUrl(urlStr: string): mysql.PoolOptions {
  let cleanUrl = urlStr.trim();
  if (cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) {
    cleanUrl = cleanUrl.slice(1, -1).trim();
  }
  if (cleanUrl.startsWith("'") && cleanUrl.endsWith("'")) {
    cleanUrl = cleanUrl.slice(1, -1).trim();
  }

  // If it doesn't start with mysql:// or mysqls://, return as uri directly
  if (!cleanUrl.startsWith('mysql://') && !cleanUrl.startsWith('mysqls://')) {
    return {
      uri: cleanUrl,
      waitForConnections: true,
      connectionLimit: 30,
      queueLimit: 0,
    } as any;
  }

  // Try standard URL parser first
  try {
    const parsed = new URL(cleanUrl);
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 3306,
      user: parsed.username ? decodeURIComponent(parsed.username) : 'root',
      password: parsed.password ? decodeURIComponent(parsed.password) : '',
      database: parsed.pathname ? decodeURIComponent(parsed.pathname.substring(1)) : '',
      waitForConnections: true,
      connectionLimit: 30,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    };
  } catch (urlError) {
    // Fallback to regex parser if the password contains unencoded special characters like @, :, #, ? etc.
    const match = cleanUrl.match(/^(?:mysql|mysqls):\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^?]+)/);
    if (match) {
      return {
        user: decodeURIComponent(match[1]),
        password: decodeURIComponent(match[2]),
        host: match[3],
        port: match[4] ? parseInt(match[4], 10) : 3306,
        database: decodeURIComponent(match[5]),
        waitForConnections: true,
        connectionLimit: 30,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
      };
    }

    // Ultimate fallback: return as uri
    return {
      uri: cleanUrl,
      waitForConnections: true,
      connectionLimit: 30,
      queueLimit: 0,
    } as any;
  }
}

try {
  const config = parseDatabaseUrl(dbUrl);
  pool = mysql.createPool(config);
} catch (error) {
  console.error('[MySQL] Failed to parse DATABASE_URL, attempting default config:', error);
  pool = mysql.createPool({
    host: 'mysql',
    user: 'imvelo_user',
    password: 'imvelo_secure_password',
    database: 'imvelo_shift_db',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 30,
    queueLimit: 0
  });
}

export function useMySQL(): boolean {
  return true; // Always use MySQL persistence
}

export { pool };

// Execute query helper using connection pool
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const [results] = await pool.execute(sql, params);
  return results as T;
}

// Transaction execution helper
export async function transaction<T>(callback: (connection: any) => Promise<T>): Promise<T> {
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

// Initialize tables, retry indefinitely every 5 seconds if unavailable
export async function initTables() {
  let connected = false;

  while (!connected) {
    try {
      console.log('[Database] Waiting for MySQL availability...');
      const connection = await pool.getConnection();
      connection.release();
      connected = true;
      console.log('[Database] Connected successfully.');
      console.log('[Database] Using Docker MySQL only.');
      console.log('[Database] JSON persistence disabled.');
      console.log('[Database] Mock persistence disabled.');
    } catch (err) {
      console.warn('[Database] Waiting for MySQL availability...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  try {
    const fs = await import('fs');
    const path = await import('path');

    // 1. Initialize DB from schema.sql if users table doesn't exist
    try {
      const tables = await query<any[]>("SHOW TABLES");
      const tableNames = tables.map(t => Object.values(t)[0] as string);
      if (!tableNames.includes('users')) {
        console.log('[MySQL] Core tables not found. Initializing from schema.sql...');
        const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
          const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
          for (const statement of statements) {
            try {
              await query(statement);
            } catch (stmtErr) {
              // Ignore use database or similar minor errors
            }
          }
          console.log('[MySQL] Core tables initialized from schema.sql successfully.');
        }
      }
    } catch (tblErr) {
      console.error('[MySQL] Failed to check/create core tables:', tblErr);
    }

    // 2. Automatic seeding if tables are empty
    try {
      const usersCountRows = await query<any[]>('SELECT COUNT(*) as count FROM users');
      const count = usersCountRows[0]?.count || 0;
      if (count === 0) {
        console.log('[Database] Database is empty. Seeding roles, departments, sections, machines, and admin user...');
        
        // Roles
        await query("INSERT INTO roles (id, name) VALUES ('1', 'Employee') ON DUPLICATE KEY UPDATE name=name");
        await query("INSERT INTO roles (id, name) VALUES ('2', 'Supervisor') ON DUPLICATE KEY UPDATE name=name");
        await query("INSERT INTO roles (id, name) VALUES ('3', 'Admin') ON DUPLICATE KEY UPDATE name=name");

        // Departments
        await query("INSERT INTO departments (id, name) VALUES ('1', 'Production') ON DUPLICATE KEY UPDATE name=name");
        await query("INSERT INTO departments (id, name) VALUES ('2', 'Packaging') ON DUPLICATE KEY UPDATE name=name");
        await query("INSERT INTO departments (id, name) VALUES ('3', 'Maintenance') ON DUPLICATE KEY UPDATE name=name");

        // Sections
        await query("INSERT INTO sections (id, name, department_id) VALUES ('1', 'Milling', '1') ON DUPLICATE KEY UPDATE name=name");
        await query("INSERT INTO sections (id, name, department_id) VALUES ('2', 'Assembly', '1') ON DUPLICATE KEY UPDATE name=name");
        await query("INSERT INTO sections (id, name, department_id) VALUES ('3', 'QA', '2') ON DUPLICATE KEY UPDATE name=name");

        // Machines
        await query("INSERT INTO machines (id, name, code, section_id) VALUES ('1', 'Milling Mach 1', 'MM01', '1') ON DUPLICATE KEY UPDATE name=name");
        await query("INSERT INTO machines (id, name, code, section_id) VALUES ('2', 'Assembly Line 1', 'AL01', '2') ON DUPLICATE KEY UPDATE name=name");
        await query("INSERT INTO machines (id, name, code, section_id) VALUES ('3', 'QA Station 1', 'QA01', '3') ON DUPLICATE KEY UPDATE name=name");

        // Shifts
        await query("INSERT INTO shifts (id, name, code, start_time, end_time) VALUES ('1', 'Morning Shift', 'A', '06:00:00', '14:00:00') ON DUPLICATE KEY UPDATE code=code");
        await query("INSERT INTO shifts (id, name, code, start_time, end_time) VALUES ('2', 'Afternoon Shift', 'B', '14:00:00', '22:00:00') ON DUPLICATE KEY UPDATE code=code");
        await query("INSERT INTO shifts (id, name, code, start_time, end_time) VALUES ('3', 'Night Shift', 'C', '22:00:00', '06:00:00') ON DUPLICATE KEY UPDATE code=code");

        // Admin user ADMIN001
        await query(`
          INSERT INTO users (id, clock_id, name, password_hash, role_id, department_id, section_id, machine_id, status, onboarding_completed_at)
          VALUES ('ADMIN001', 'ADMIN001', 'Admin', 't33th123!', '3', '1', '1', '1', 'active', CURRENT_TIMESTAMP)
          ON DUPLICATE KEY UPDATE clock_id=clock_id
        `);

        console.log('[Database] Seeding completed successfully. Created administrator ADMIN001.');
      }
    } catch (seedErr) {
      console.error('[MySQL] Seeding failed:', seedErr);
    }

    // 3. Ensure multi-level review tables exist
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

    // Ensure users table has telegram and notifications columns
    try {
      await query('ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR(100) NULL');
      console.log('[MySQL] Added telegram_chat_id column to users table.');
    } catch (_) {}
    try {
      await query('ALTER TABLE users ADD COLUMN telegram_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE');
      console.log('[MySQL] Added telegram_notifications_enabled column to users table.');
    } catch (_) {}
    try {
      await query('ALTER TABLE users ADD COLUMN in_app_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE');
      console.log('[MySQL] Added in_app_notifications_enabled column to users table.');
    } catch (_) {}
    try {
      await query('ALTER TABLE users ADD COLUMN internal_messages_enabled BOOLEAN NOT NULL DEFAULT TRUE');
      console.log('[MySQL] Added internal_messages_enabled column to users table.');
    } catch (_) {}
    try {
      await query('ALTER TABLE users ADD COLUMN telegram_username VARCHAR(100) NULL');
      console.log('[MySQL] Added telegram_username column to users table.');
    } catch (_) {}

    // Ensure notification_delivery_logs table is created
    await query(`
      CREATE TABLE IF NOT EXISTS notification_delivery_logs (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        channel VARCHAR(50) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        error_message TEXT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Ensure telegram_link_requests table is created
    await query(`
      CREATE TABLE IF NOT EXISTS telegram_link_requests (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        link_code VARCHAR(100) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Ensure telegram_link_audit table is created
    await query(`
      CREATE TABLE IF NOT EXISTS telegram_link_audit (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        telegram_chat_id VARCHAR(100) NOT NULL,
        action ENUM('LINK', 'UNLINK') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('[MySQL] Notification preference columns, delivery logs, telegram link requests, and audit tables checked/created successfully.');

    console.log('[MySQL] Multi-level review tables checked/created successfully.');

    // 4. Load data from MySQL to populate dbInstance state
    try {
      const { dbInstance } = await import('./database');
      await dbInstance.loadFromMySQL();
    } catch (dbLoadErr) {
      console.error('[MySQL] Failed to load data into dbInstance state:', dbLoadErr);
    }

    // 5. Initialize ScheduleResolutionService Cache
    try {
      const { ScheduleResolutionService } = await import('../services/ScheduleResolutionService');
      await ScheduleResolutionService.initCache();
    } catch (cacheErr) {
      console.error('[MySQL] Failed to initialize ScheduleResolutionService Cache:', cacheErr);
    }

    // 6. Start Telegram Bot Polling
    try {
      const { TelegramNotificationService } = await import('../services/TelegramNotificationService');
      TelegramNotificationService.startPolling();
    } catch (tgErr) {
      console.error('[MySQL] Failed to start Telegram Bot polling:', tgErr);
    }

  } catch (err) {
    console.error('[MySQL] Error initializing tables:', err);
  }
}

// Trigger async initialization
initTables().catch(e => console.error('[MySQL] Init tables failed:', e));
