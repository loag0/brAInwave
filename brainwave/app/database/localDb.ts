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
        remote_id INTEGER UNIQUE,
        title TEXT,
        rawContent TEXT,
        aiPlan TEXT,
        file_uri TEXT,
        file_type TEXT,
        is_dirty INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS timetables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        remote_id INTEGER,
        title TEXT,
        structuredData TEXT,
        uri TEXT,
        type TEXT,
        is_dirty INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS daily_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        remote_id INTEGER,
        date TEXT,
        items_json TEXT,
        is_dirty INTEGER DEFAULT 0,
        generated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS completion_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        date TEXT,
        minutes_studied INTEGER DEFAULT 0,
        UNIQUE(user_id, date)
      );

      CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        remote_id INTEGER UNIQUE,
        title TEXT,
        subject TEXT,
        due_date TEXT,
        priority TEXT,
        rawContent TEXT,
        file_uri TEXT,
        file_type TEXT,
        is_dirty INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS flashcards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        material_id INTEGER,
        question TEXT,
        answer TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migrations for existing installs
    try {
      db.execSync(
        `ALTER TABLE study_materials ADD COLUMN is_deleted INTEGER DEFAULT 0`,
      );
    } catch {}
    try {
      db.execSync(
        `ALTER TABLE timetables ADD COLUMN is_deleted INTEGER DEFAULT 0`,
      );
    } catch {}
    try {
      db.execSync(
        `ALTER TABLE assignments ADD COLUMN is_deleted INTEGER DEFAULT 0`,
      );
    } catch {}
    try {
      db.execSync(
        `ALTER TABLE daily_plans ADD COLUMN is_dirty INTEGER DEFAULT 0`,
      );
    } catch {}
    try {
      db.execSync(`ALTER TABLE daily_plans ADD COLUMN remote_id INTEGER`);
    } catch {}
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
      `SELECT * FROM study_materials WHERE user_id = ? AND is_deleted = 0 ORDER BY id DESC`,
      [userId],
    );
  },

  getMaterialById: (userId: string, id: string) => {
    return db.getFirstSync(
      `SELECT title, aiPlan, remote_id FROM study_materials
      WHERE user_id = ? AND (id = ? OR remote_id = ?) AND is_deleted = 0`,
      [userId, id, id],
    ) as { title: string; aiPlan: string; remote_id: number } | undefined;
  },

  createMaterialLocally: (
    userId: string,
    title: string,
    rawContent: string,
    uri?: string,
    type?: string,
  ) => {
    const result = db.runSync(
      `INSERT INTO study_materials (user_id, title, rawContent, file_uri, file_type, is_dirty, is_deleted) VALUES (?, ?, ?, ?, ?, 1, 0)`,
      [userId, title, rawContent, uri || null, type || null],
    );
    return result.lastInsertRowId;
  },

  syncMaterialsFromServer: async (userId: string, materials: any[]) => {
    const remoteIds = materials.map((m) => m.id);
    if (remoteIds.length > 0) {
      const placeholders = remoteIds.map(() => "?").join(",");
      db.runSync(
        `DELETE FROM study_materials WHERE user_id = ? AND is_dirty = 0 AND remote_id NOT IN (${placeholders})`,
        [userId, ...remoteIds],
      );
    } else {
      db.runSync(
        `DELETE FROM study_materials WHERE user_id = ? AND is_dirty = 0`,
        [userId],
      );
    }
    for (const m of materials) {
      db.runSync(
        `INSERT OR REPLACE INTO study_materials (user_id, remote_id, title, rawContent, aiPlan, is_dirty, is_deleted)
         VALUES (?, ?, ?, ?, ?, 0, 0)`,
        [userId, m.id, m.title, m.rawContent, m.aiPlan],
      );
    }
  },

  markMaterialSynced: (localId: number, remoteId: number, aiPlan?: string) => {
    if (aiPlan) {
      db.runSync(
        `UPDATE study_materials SET is_dirty = 0, remote_id = ?, aiPlan = ? WHERE id = ?`,
        [remoteId, aiPlan, localId],
      );
    } else {
      db.runSync(
        `UPDATE study_materials SET is_dirty = 0, remote_id = ? WHERE id = ?`,
        [remoteId, localId],
      );
    }
  },

  deleteMaterial: (userId: string, id: string | number) => {
    db.runSync(
      `UPDATE study_materials SET is_dirty = 1, is_deleted = 1
       WHERE user_id = ? AND (id = ? OR remote_id = ?)`,
      [userId, id, id],
    );
  },

  hardDeleteMaterial: (localId: number) => {
    db.runSync(`DELETE FROM study_materials WHERE id = ?`, [localId]);
  },

  // TIMETABLES

  getAllTimetables: (userId: string) => {
    const results = db.getAllSync(
      `SELECT * FROM timetables WHERE user_id = ? AND is_deleted = 0 ORDER BY id DESC`,
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
      `INSERT INTO timetables (user_id, title, structuredData, uri, type, is_dirty, is_deleted) VALUES (?, ?, ?, ?, ?, 1, 0)`,
      [userId, title, JSON.stringify(data), uri || null, type || null],
    );
    return result.lastInsertRowId;
  },

  syncTimetablesFromServer: (userId: string, tables: any[]) => {
    const remoteIds = tables.map((t) => t.id);
    if (remoteIds.length > 0) {
      const placeholders = remoteIds.map(() => "?").join(",");
      db.runSync(
        `DELETE FROM timetables WHERE user_id = ? AND is_dirty = 0 AND remote_id NOT IN (${placeholders})`,
        [userId, ...remoteIds],
      );
    } else {
      db.runSync(`DELETE FROM timetables WHERE user_id = ? AND is_dirty = 0`, [
        userId,
      ]);
    }
    for (const t of tables) {
      db.runSync(
        `INSERT OR REPLACE INTO timetables (user_id, remote_id, title, structuredData, is_dirty, is_deleted)
         VALUES (?, ?, ?, ?, 0, 0)`,
        [userId, t.id, t.title, JSON.stringify(t.structuredData)],
      );
    }
  },

  markTimetableSynced: (
    localId: number,
    remoteId: number,
    structuredData?: any,
  ) => {
    if (structuredData) {
      db.runSync(
        `UPDATE timetables SET is_dirty = 0, remote_id = ?, structuredData = ? WHERE id = ?`,
        [remoteId, JSON.stringify(structuredData), localId],
      );
    } else {
      db.runSync(
        `UPDATE timetables SET is_dirty = 0, remote_id = ? WHERE id = ?`,
        [remoteId, localId],
      );
    }
  },

  deleteTimetable: (userId: string, id: string | number) => {
    db.runSync(
      `UPDATE timetables SET is_dirty = 1, is_deleted = 1
       WHERE user_id = ? AND (id = ? OR remote_id = ?)`,
      [userId, id, id],
    );
  },

  hardDeleteTimetable: (localId: number) => {
    db.runSync(`DELETE FROM timetables WHERE id = ?`, [localId]);
  },

  // DAILY PLANS

  getPlanByDate: (userId: string, date: string) => {
    const row = db.getFirstSync(
      `SELECT * FROM daily_plans WHERE user_id = ? AND date = ?`,
      [userId, date],
    ) as any;
    if (!row) return null;
    return {
      ...row,
      tasks: row.items_json ? JSON.parse(row.items_json) : [],
    };
  },

  getAllPlans: (userId: string) => {
    const results = db.getAllSync(
      `SELECT * FROM daily_plans WHERE user_id = ? ORDER BY date DESC`,
      [userId],
    );
    return results.map((row: any) => ({
      ...row,
      tasks: row.items_json ? JSON.parse(row.items_json) : [],
    }));
  },

  // isDirty defaults true — only pass false when syncing inbound from server
  upsertPlan: (userId: string, date: string, items: any[], isDirty = true) => {
    const itemsJson = JSON.stringify(items || []);
    const dirtyFlag = isDirty ? 1 : 0;
    const result = db.runSync(
      `UPDATE daily_plans SET items_json = ?, is_dirty = ? WHERE user_id = ? AND date = ?`,
      [itemsJson, dirtyFlag, userId, date],
    );
    if (!result.changes) {
      db.runSync(
        `INSERT INTO daily_plans (user_id, date, items_json, is_dirty) VALUES (?, ?, ?, ?)`,
        [userId, date, itemsJson, dirtyFlag],
      );
    }
  },

  // Called after backend confirms plan saved successfully
  markPlanSynced: (userId: string, date: string, remoteId?: number) => {
    if (remoteId) {
      db.runSync(
        `UPDATE daily_plans SET is_dirty = 0, remote_id = ? WHERE user_id = ? AND date = ?`,
        [remoteId, userId, date],
      );
    } else {
      db.runSync(
        `UPDATE daily_plans SET is_dirty = 0 WHERE user_id = ? AND date = ?`,
        [userId, date],
      );
    }
  },

  // Inbound sync from server — always marks as clean
  syncPlansFromServer: (userId: string, plans: any[]) => {
    db.runSync(`DELETE FROM daily_plans WHERE user_id = ?`, [userId]);
    for (const p of plans) {
      const itemsJson = JSON.stringify(p.tasks || p.items || []);
      db.runSync(
        `INSERT INTO daily_plans (user_id, date, items_json, is_dirty) VALUES (?, ?, ?, 0)`,
        [userId, p.date || p.id, itemsJson],
      );
    }
  },

  // ASSIGNMENTS
  getAllAssignments: (userId: string) => {
    return db.getAllSync(
      `SELECT * FROM assignments WHERE user_id = ? AND is_deleted = 0 ORDER BY due_date ASC`,
      [userId],
    );
  },

  getAssignmentById: (userId: string, id: string) => {
    return db.getFirstSync(
      `SELECT * FROM assignments WHERE user_id = ? AND (id = ? OR remote_id = ?) AND is_deleted = 0`,
      [userId, id, id],
    );
  },

  updateAssignmentDueDate: (id: number, newDueDate: string) => {
    db.runSync(
      `UPDATE assignments SET due_date = ?, is_dirty = 1 WHERE id = ?`,
      [newDueDate, id],
    );
  },

  createAssignmentLocally: (
    userId: string,
    title: string,
    subject: string,
    dueDate: string,
    priority: string,
    rawContent: string,
    uri?: string,
    type?: string,
  ) => {
    const result = db.runSync(
      `INSERT INTO assignments (user_id, title, subject, due_date, priority, rawContent, file_uri, file_type, is_dirty, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        userId,
        title,
        subject,
        dueDate,
        priority,
        rawContent,
        uri || null,
        type || null,
      ],
    );
    return result.lastInsertRowId;
  },

  syncAssignmentsFromServer: (userId: string, assignments: any[]) => {
    const remoteIds = assignments.map((a) => a.id);
    if (remoteIds.length > 0) {
      const placeholders = remoteIds.map(() => "?").join(",");
      db.runSync(
        `DELETE FROM assignments WHERE user_id = ? AND is_dirty = 0 AND remote_id NOT IN (${placeholders})`,
        [userId, ...remoteIds],
      );
    } else {
      db.runSync(`DELETE FROM assignments WHERE user_id = ? AND is_dirty = 0`, [
        userId,
      ]);
    }
    for (const a of assignments) {
      db.runSync(
        `INSERT OR REPLACE INTO assignments (user_id, remote_id, title, subject, due_date, priority, rawContent, is_dirty, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [
          userId,
          a.id,
          a.title,
          a.subject,
          a.due_date,
          a.priority,
          a.rawContent,
        ],
      );
    }
  },

  markAssignmentSynced: (
    localId: number,
    remoteId: number,
    extraData?: any,
  ) => {
    if (extraData) {
      db.runSync(
        `UPDATE assignments SET is_dirty = 0, remote_id = ?, title = ?, subject = ?, due_date = ?, priority = ?, rawContent = ?
         WHERE id = ?`,
        [
          remoteId,
          extraData.title,
          extraData.subject,
          extraData.due_date,
          extraData.priority,
          extraData.rawContent,
          localId,
        ],
      );
    } else {
      db.runSync(
        `UPDATE assignments SET is_dirty = 0, remote_id = ? WHERE id = ?`,
        [remoteId, localId],
      );
    }
  },

  deleteAssignment: (userId: string, id: string) => {
    db.runSync(
      `UPDATE assignments SET is_dirty = 1, is_deleted = 1
       WHERE user_id = ? AND (id = ? OR remote_id = ?)`,
      [userId, id, id],
    );
  },

  hardDeleteAssignment: (localId: number) => {
    db.runSync(`DELETE FROM assignments WHERE id = ?`, [localId]);
  },

  // FLASHCARDS

  getFlashcards: (userId: string, materialId: string | number) => {
    return db.getAllSync(
      `SELECT * FROM flashcards WHERE user_id = ? AND material_id = ? ORDER BY id ASC`,
      [userId, materialId],
    );
  },

  saveFlashcards: (
    userId: string,
    materialId: string | number,
    cards: any[],
  ) => {
    db.runSync(`DELETE FROM flashcards WHERE user_id = ? AND material_id = ?`, [
      userId,
      materialId,
    ]);
    for (const card of cards) {
      db.runSync(
        `INSERT INTO flashcards (user_id, material_id, question, answer) VALUES (?, ?, ?, ?)`,
        [userId, materialId, card.question, card.answer],
      );
    }
  },

  deleteFlashcards: (userId: string, materialId: string | number) => {
    db.runSync(`DELETE FROM flashcards WHERE user_id = ? AND material_id = ?`, [
      userId,
      materialId,
    ]);
  },

  // COMPLETION & STREAKS

  logStudyTime: (userId: string, date: string, minutes: number) => {
    db.runSync(
      `INSERT INTO completion_logs (user_id, date, minutes_studied)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET minutes_studied = minutes_studied + ?`,
      [userId, date, minutes, minutes],
    );
  },

  getWeeklyActivity: (userId: string) => {
    return db.getAllSync(
      `SELECT date, minutes_studied FROM completion_logs
       WHERE user_id = ? AND date >= date('now', '-7 days')
       ORDER BY date ASC`,
      [userId],
    );
  },

  getStreakCount: (userId: string) => {
    const rows = db.getAllSync(
      `SELECT date FROM completion_logs
       WHERE user_id = ? AND minutes_studied > 0
       ORDER BY date DESC`,
      [userId],
    ) as { date: string }[];

    if (rows.length === 0) return 0;

    let streak = 0;
    const now = new Date();
    const checkDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const lastDate = new Date(rows[0].date);
    const diffDays = Math.floor(
      (checkDate.getTime() - lastDate.getTime()) / 86400000,
    );

    if (diffDays > 1) return 0;

    for (let i = 0; i < rows.length; i++) {
      if (i > 0) {
        const prevDate = new Date(rows[i - 1].date);
        const recordDate = new Date(rows[i].date);
        const dayDifference = Math.floor(
          (prevDate.getTime() - recordDate.getTime()) / 86400000,
        );
        if (dayDifference === 1) {
          streak++;
        } else {
          break;
        }
      } else {
        streak = 1;
      }
    }

    return streak;
  },
};