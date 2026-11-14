const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
const backendDir = path.resolve(__dirname, '../../');
dotenv.config({ path: path.join(backendDir, '.env') });

const dbPathSetting = process.env.DATABASE_PATH || 'database/expense-tracker.db';
// Always resolve relative to the backend directory
const resolvedDbPath = path.isAbsolute(dbPathSetting)
  ? dbPathSetting
  : path.resolve(backendDir, dbPathSetting);

// Ensure parent directory exists
const dbDir = path.dirname(resolvedDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

try {
  // First attempt: try better-sqlite3
  const BetterSqlite3 = require('better-sqlite3');
  dbInstance = new BetterSqlite3(resolvedDbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
} catch (loadError) {
  // If Windows Smart App Control or an OS policy blocks the unsigned native binary,
  // fall back seamlessly to Node.js's built-in SQLite engine (node:sqlite)
  console.warn(
    `[Database] Note: better-sqlite3 native binary could not be loaded (${loadError.message}). Falling back to Node.js built-in SQLite engine.`
  );

  const { DatabaseSync } = require('node:sqlite');
  const nativeDb = new DatabaseSync(resolvedDbPath);
  nativeDb.exec('PRAGMA journal_mode = WAL;');
  nativeDb.exec('PRAGMA foreign_keys = ON;');

  dbInstance = {
    exec(sql) {
      return nativeDb.exec(sql);
    },
    pragma(str) {
      try {
        return nativeDb.exec(`PRAGMA ${str}`);
      } catch {
        return null;
      }
    },
    prepare(sql) {
      const rawStmt = nativeDb.prepare(sql);
      const normalizeParams = (arg) => {
        if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
          const dict = {};
          for (const [k, v] of Object.entries(arg)) {
            const val = v === undefined ? null : v;
            if (sql.includes(`@${k}`)) {
              dict[`@${k}`] = val;
            } else if (sql.includes(`:${k}`)) {
              dict[`:${k}`] = val;
            } else if (sql.includes(`$${k}`)) {
              dict[`$${k}`] = val;
            } else {
              dict[k] = val;
            }
          }
          return dict;
        }
        return arg;
      };

      return {
        run(...args) {
          if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
            const res = rawStmt.run(normalizeParams(args[0]));
            return {
              changes: Number(res.changes || 0),
              lastInsertRowid: Number(res.lastInsertRowid || 0),
            };
          }
          const res = rawStmt.run(...args);
          return {
            changes: Number(res.changes || 0),
            lastInsertRowid: Number(res.lastInsertRowid || 0),
          };
        },
        get(...args) {
          if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
            const row = rawStmt.get(normalizeParams(args[0]));
            return row ? { ...row } : undefined;
          }
          const row = rawStmt.get(...args);
          return row ? { ...row } : undefined;
        },
        all(...args) {
          if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
            const rows = rawStmt.all(normalizeParams(args[0]));
            return rows.map((r) => ({ ...r }));
          }
          const rows = rawStmt.all(...args);
          return rows.map((r) => ({ ...r }));
        },
      };
    },
  };
}

// Initialize schema (creates tables and indexes if not existing)
const schemaPath = path.resolve(backendDir, 'database/schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  dbInstance.exec(schemaSql);
}

// Ensure user_id column exists on existing transactions table
try {
  const txCols = dbInstance.prepare("PRAGMA table_info(transactions)").all();
  if (!txCols.some((c) => c.name === 'user_id')) {
    dbInstance.exec("ALTER TABLE transactions ADD COLUMN user_id INTEGER;");
    dbInstance.exec("CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);");
  }
} catch (e) {
  console.warn('[Database Migration] Error checking user_id on transactions:', e.message);
}

// Ensure user_id column exists on existing monthly_budgets table
try {
  const budgetCols = dbInstance.prepare("PRAGMA table_info(monthly_budgets)").all();
  if (!budgetCols.some((c) => c.name === 'user_id')) {
    dbInstance.exec("ALTER TABLE monthly_budgets ADD COLUMN user_id INTEGER;");
    dbInstance.exec("CREATE INDEX IF NOT EXISTS idx_budgets_user ON monthly_budgets(user_id);");
  }
} catch (e) {
  console.warn('[Database Migration] Error checking user_id on monthly_budgets:', e.message);
}

module.exports = dbInstance;
