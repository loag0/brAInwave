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

  markTimetableSynced: (localId: number, remoteId: number) => {
    db.runSync(
      `UPDATE timetables SET is_dirty = 0, remote_id = ? WHERE id = ?`,
      [remoteId, localId],
    );
  },
};
