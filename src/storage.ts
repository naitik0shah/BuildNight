import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

export interface StorageStatus {
  type: 'postgres' | 'file';
  connected: boolean;
  info: string;
}

export class Storage {
  private file: string;
  private pool: Pool | null = null;
  private status: StorageStatus = {
    type: 'file',
    connected: true,
    info: 'Local JSON file storage active.',
  };

  constructor(filePath?: string) {
    this.file = filePath || process.env.DB_FILE || 'data/db.json';
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        this.pool = new Pool({
          connectionString: dbUrl,
          ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
            ? false
            : { rejectUnauthorized: false },
          connectionTimeoutMillis: 5000,
        });
        this.status = {
          type: 'postgres',
          connected: false,
          info: 'Connecting to PostgreSQL database...',
        };
      } catch (err: any) {
        console.warn('[Storage] Failed to initialize PostgreSQL pool:', err.message);
        this.pool = null;
      }
    }
  }

  async init(defaultData: any): Promise<any> {
    // 1. Try PostgreSQL if configured
    if (this.pool) {
      try {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS bahi_store (
            id VARCHAR(64) PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `);
        const res = await this.pool.query('SELECT data FROM bahi_store WHERE id = $1', ['main']);
        if (res.rows.length > 0 && res.rows[0].data) {
          this.status = {
            type: 'postgres',
            connected: true,
            info: 'Connected to PostgreSQL database.',
          };
          console.log('[Storage] Loaded data from PostgreSQL database.');
          return res.rows[0].data;
        }

        // If table was empty but local file exists, seed Postgres from local file
        const fileData = this.readLocalFile();
        const initial = fileData || defaultData;
        await this.pool.query(
          `INSERT INTO bahi_store (id, data, updated_at)
           VALUES ('main', $1, NOW())
           ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`,
          [JSON.stringify(initial)]
        );
        this.status = {
          type: 'postgres',
          connected: true,
          info: 'Connected to PostgreSQL database (initialized data).',
        };
        console.log('[Storage] Initialized PostgreSQL database with starter data.');
        return initial;
      } catch (err: any) {
        console.warn('[Storage] PostgreSQL connection failed, falling back to local file:', err.message);
        this.status = {
          type: 'postgres',
          connected: false,
          info: `PostgreSQL connection error: ${err.message}. Using local file fallback.`,
        };
      }
    }

    // 2. Fall back to local file
    const fileData = this.readLocalFile();
    if (fileData) {
      return fileData;
    }
    return defaultData;
  }

  private readLocalFile(): any {
    try {
      if (fs.existsSync(this.file)) {
        const raw = fs.readFileSync(this.file, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e: any) {
      console.warn('[Storage] Failed to read local database file:', e.message);
    }
    return null;
  }

  async save(data: any): Promise<void> {
    // Save to local file atomically
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file + '.tmp', JSON.stringify(data));
      fs.renameSync(this.file + '.tmp', this.file);
    } catch (err: any) {
      console.error('[Storage] Error saving to file:', err.message);
    }

    // Also persist to PostgreSQL if available
    if (this.pool && this.status.connected) {
      try {
        await this.pool.query(
          `INSERT INTO bahi_store (id, data, updated_at)
           VALUES ('main', $1, NOW())
           ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`,
          [JSON.stringify(data)]
        );
      } catch (err: any) {
        console.error('[Storage] Error saving to PostgreSQL:', err.message);
        this.status.connected = false;
        this.status.info = `PostgreSQL write error: ${err.message}`;
      }
    }
  }

  getStatus(): StorageStatus {
    return this.status;
  }
}
