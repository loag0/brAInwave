import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("brainwave.db");

export const LocalDB = {
  init: () => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        studyPreferences TEXT,
        hasFinishedSetup INTEGER
      );

      CREATE TABLE IF NOT EXISTS study_materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        remote_id INTEGER,
        title TEXT,
        rawContent TEXT,
        aiPlan TEXT,
        uri TEXT,     -- Added to store file path for syncing
        type TEXT,    -- Added to store file type for syncing
        is_dirty INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS timetables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        remote_id INTEGER,
        title TEXT,
        structuredData TEXT,
        uri TEXT,     -- Added for syncing
        type TEXT,    -- Added for syncing
        is_dirty INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS daily_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        date TEXT,
        items_json TEXT,
        generated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  },

  async saveUser(user: any) {
    const prefs = JSON.stringify(user.studyPreferences);
    db.runSync(
      `INSERT OR REPLACE INTO user_profile (id, name, email, studyPreferences, hasFinishedSetup) VALUES (?, ?, ?, ?, ?)`,
      [user.id, user.name, user.email, prefs, user.hasFinishedSetup ? 1 : 0],
    );
  },

  getUser: (uid: string) => {
    return db.getFirstSync(`SELECT * FROM user_profile WHERE id = ?`, [uid]);
  },

  // MATERIALS
  getAllMaterials: (userId: string) => {
    return db.getAllSync(
      `SELECT * FROM study_materials WHERE user_id = ? ORDER BY id DESC`,
      [userId],
    );
  },

  getPlanByDate: (userId: string, date: string) => {
    const row = db.getFirstSync(
      `SELECT * FROM daily_plans WHERE user_id = ? AND date = ?`,
      [userId, date]
    ) as any;
    if(!row) return null;
    return {
      ...row,
      tasks: row.items_json ? JSON.parse(row.items_json) : [],
    }
  },

  getAllPlans: (userId: string) => {
    const results = db.getAllSync(
      `SELECT * FROM daily_plans WHERE user_id = ? ORDER BY date DESC`,
      [userId]
    );
    return results.map((row: any) => ({
      ...row,
      tasks: row.items_json ? JSON.parse(row.items_json) : [],
    }));
  },

  upsertPlan: (userId: string, date: string, items: any[]) => {
    const itemsJson = JSON.stringify(items || []);

    // Try update first
    const result = db.runSync(
      `UPDATE daily_plans SET items_json = ? WHERE user_id = ? AND date = ?`,
      [itemsJson, userId, date],
    );

    // If nothing was updated, insert a new row
    if (!result.changes) {
      db.runSync(
        `INSERT INTO daily_plans (user_id, date, items_json) VALUES (?, ?, ?)`,
        [userId, date, itemsJson],
      );
    }
  },

  syncPlansFromServer: (userId: string, plans: any[]) => {
  // 1️⃣ delete all existing plans for this user first
  db.runSync(`DELETE FROM daily_plans WHERE user_id = ?`, [userId]);

  // 2️⃣ insert fresh plans from server
  for (const p of plans){
    const itemsJson = JSON.stringify(p.tasks || p.items || []);
    db.runSync(
      `INSERT INTO daily_plans (user_id, date, items_json) VALUES (?, ?, ?)`,
      [userId, p.date || p.id, itemsJson]
    );
  }},

  createMaterialLocally: (
    userId: string,
    title: string,
    rawContent: string,
    uri?: string,
    type?: string,
  ) => {
    const result = db.runSync(
      `INSERT INTO study_materials (user_id, title, rawContent, uri, type, is_dirty) VALUES (?, ?, ?, ?, ?, 1)`,
      [userId, title, rawContent, uri || null, type || null],
    );
    return result.lastInsertRowId;
  },

  syncMaterialsFromServer: (userId: string, materials: any[]) => {
    for (const m of materials) {
      db.runSync(
        `INSERT OR REPLACE INTO study_materials (user_id, remote_id, title, rawContent, aiPlan, is_dirty) 
         VALUES (?, ?, ?, ?, ?, 0)`,
        [userId, m.id, m.title, m.rawContent, m.aiPlan],
      );
    }
  },

  markMaterialSynced: (localId: number, remoteId: number) => {
    db.runSync(
      `UPDATE study_materials SET is_dirty = 0, remote_id = ? WHERE id = ?`,
      [remoteId, localId],
    );
  },

  // TIMETABLES
  getAllTimetables: (userId: string) => {
    const results = db.getAllSync(
      `SELECT * FROM timetables WHERE user_id = ? ORDER BY id DESC`,
      [userId],
    );
    return results.map((row: any) => ({
      ...row,
      structuredData: row.structuredData
        ? JSON.parse(row.structuredData)
        : null,
    }));
  },

  createTimetableLocally: (
    userId: string,
    title: string,
    data: any,
    uri?: string,
    type?: string,
  ) => {
    const result = db.runSync(
      `INSERT INTO timetables (user_id, title, structuredData, uri, type, is_dirty) VALUES (?, ?, ?, ?, ?, 1)`,
      [userId, title, JSON.stringify(data), uri || null, type || null],
    );
    return result.lastInsertRowId;
  },

  syncTimetablesFromServer: (userId: string, tables: any[]) => {
    for (const t of tables) {
      db.runSync(
        `INSERT OR REPLACE INTO timetables (user_id, remote_id, title, structuredData, is_dirty)
         VALUES (?, ?, ?, ?, 0)`,
        [userId, t.id, t.title, JSON.stringify(t.structuredData)],
      );
    }
  },

  markTimetableSynced: (
    localId: number,
    remoteId: number,
    structuredData?: any,
  ) => {
    // When the backend has parsed the timetable, persist the structured template locally
    if (structuredData) {
      db.runSync(
        `UPDATE timetables 
         SET is_dirty = 0, remote_id = ?, structuredData = ? 
         WHERE id = ?`,
        [remoteId, JSON.stringify(structuredData), localId],
      );
    } else {
      db.runSync(
        `UPDATE timetables SET is_dirty = 0, remote_id = ? WHERE id = ?`,
        [remoteId, localId],
      );
    }
  },
};
