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
        hasFinishedSetup INTEGER,
        year_of_study TEXT,
        degree TEXT,
        weak_areas TEXT
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
        module_tag TEXT,
        is_dirty INTEGER DEFAULT 1,
        UNIQUE(user_id, date, module_tag)
      );

      CREATE TABLE IF NOT EXISTS module_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        module_tag TEXT,
        weekly_goal_minutes INTEGER,
        is_dirty INTEGER DEFAULT 1,
        UNIQUE(user_id, module_tag)
      );

      CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        remote_id INTEGER UNIQUE,
        title TEXT,
        subject TEXT,
        due_date TEXT,
        due_time TEXT,
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
      db.execSync(`ALTER TABLE assignments ADD COLUMN due_time TEXT`);
    } catch {}
    try {
      db.execSync(
        `ALTER TABLE daily_plans ADD COLUMN is_dirty INTEGER DEFAULT 0`,
      );
    } catch {}
    try {
      db.execSync(`ALTER TABLE daily_plans ADD COLUMN remote_id INTEGER`);
    } catch {}
    try {
      db.execSync(`ALTER TABLE completion_logs ADD COLUMN module_tag TEXT`);
    } catch {}
    try {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS module_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        module_tag TEXT,
        weekly_goal_minutes INTEGER,
        is_dirty INTEGER DEFAULT 1,
        UNIQUE(user_id, module_tag)
        )
      `);
    } catch {}
    try {
      db.execSync(
        `ALTER TABLE module_goals ADD COLUMN is_dirty INTEGER DEFAULT 1`,
      );
    } catch {}
    try {
      db.execSync(
        `ALTER TABLE completion_logs ADD COLUMN is_dirty INTEGER DEFAULT 1`,
      );
    } catch {}
    // Fix: deduplicate rows that accumulated due to NULL not conflicting in UNIQUE constraint
    try {
      db.execSync(`
        DELETE FROM completion_logs WHERE rowid NOT IN (
          SELECT MIN(rowid) FROM completion_logs
          GROUP BY user_id, date, COALESCE(module_tag, '')
        )
      `);
    } catch {}
    // Fix: replace NULL module_tag with '' so UNIQUE(user_id, date, module_tag) works correctly
    try {
      db.execSync(`UPDATE completion_logs SET module_tag = '' WHERE module_tag IS NULL`);
    } catch {}
    // Fix: create the missing unique index on existing installs (ALTER TABLE only added the column, not the constraint)
    try {
      db.execSync(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_completion_logs_unique
        ON completion_logs(user_id, date, module_tag)
      `);
    } catch {}
    // Profile personalization columns (added for AI context system)
    try {
      db.execSync(`ALTER TABLE user_profile ADD COLUMN year_of_study TEXT`);
    } catch {}
    try {
      db.execSync(`ALTER TABLE user_profile ADD COLUMN degree TEXT`);
    } catch {}
    try {
      db.execSync(`ALTER TABLE user_profile ADD COLUMN weak_areas TEXT`);
    } catch {}
    // Module tagging for study materials
    try {
      db.execSync(`ALTER TABLE study_materials ADD COLUMN module_tag TEXT`);
    } catch {}
    // Offline assignment queuing — marks assignments awaiting server-side AI extraction
    try {
      db.execSync(`ALTER TABLE assignments ADD COLUMN pending_extraction INTEGER DEFAULT 0`);
    } catch {}
  },

  async saveUser(user: any) {
    const prefs = JSON.stringify(user.studyPreferences);
    db.runSync(
      `INSERT INTO user_profile (id, name, email, studyPreferences, hasFinishedSetup)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         email=excluded.email,
         studyPreferences=excluded.studyPreferences,
         hasFinishedSetup=excluded.hasFinishedSetup`,
      [user.id, user.name, user.email, prefs, user.hasFinishedSetup ? 1 : 0],
    );
  },

  getUser: (uid: string) => {
    return db.getFirstSync(`SELECT * FROM user_profile WHERE id = ?`, [uid]);
  },

  getLastCachedUser: () => {
    return db.getFirstSync(`SELECT * FROM user_profile LIMIT 1`);
  },

  saveUserProfile: (userId: string, yearOfStudy: string | null, degree: string | null, weakAreas: string[]) => {
    db.runSync(
      `UPDATE user_profile SET year_of_study = ?, degree = ?, weak_areas = ? WHERE id = ?`,
      [yearOfStudy, degree, JSON.stringify(weakAreas), userId],
    );
  },

  getUserProfile: (userId: string): { year_of_study: string | null; degree: string | null; weak_areas: string[] } => {
    const row = db.getFirstSync(`SELECT year_of_study, degree, weak_areas FROM user_profile WHERE id = ?`, [userId]) as any;
    if (!row) return { year_of_study: null, degree: null, weak_areas: [] };
    return {
      year_of_study: row.year_of_study ?? null,
      degree: row.degree ?? null,
      weak_areas: row.weak_areas ? JSON.parse(row.weak_areas) : [],
    };
  },

  // DIRTY RECORD READERS - used for syncing local changes to server

  getDirtyMaterials: (userId: string) => {
    return db.getAllSync(
      `SELECT * FROM study_materials WHERE user_id = ? AND is_dirty = 1`,
      [userId],
    ) as any[];
  },

  getDirtyTimetables: (userId: string) => {
    const rows = db.getAllSync(
      `SELECT * FROM timetables WHERE user_id = ? AND is_dirty = 1`,
      [userId],
    ) as any[];
    return rows.map((row) => ({
      ...row,
      structuredData: row.structuredData ? JSON.parse(row.structuredData) : null,
    }));
  },

  getDirtyAssignments: (userId: string) => {
    return db.getAllSync(
      `SELECT * FROM assignments WHERE user_id = ? AND is_dirty = 1`,
      [userId],
    ) as any[];
  },

  getDirtyPlans: (userId: string) => {
    const rows = db.getAllSync(
      `SELECT * FROM daily_plans WHERE user_id = ? AND is_dirty = 1`,
      [userId],
    ) as any[];
    return rows.map((row) => ({
      ...row,
      tasks: row.items_json ? JSON.parse(row.items_json) : [],
    }));
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
      `SELECT id, title, rawContent, aiPlan, remote_id, module_tag FROM study_materials
      WHERE user_id = ? AND (id = ? OR remote_id = ?) AND is_deleted = 0`,
      [userId, id, id],
    ) as { id: number; title: string; rawContent: string; aiPlan: string; remote_id: number; module_tag: string | null } | undefined;
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
        `INSERT INTO study_materials (user_id, remote_id, title, rawContent, aiPlan, module_tag, is_dirty, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0)
         ON CONFLICT(remote_id) DO UPDATE SET
           title = excluded.title,
           rawContent = excluded.rawContent,
           aiPlan = excluded.aiPlan,
           module_tag = excluded.module_tag,
           is_deleted = 0
         WHERE is_dirty = 0`,
        [userId, m.id, m.title, m.rawContent || "", m.aiPlan || "", m.module_tag ?? null],
      );
    }
  },

  markMaterialSynced: (localId: number, remoteId: number, aiPlan?: string, moduleTag?: string | null) => {
    if (aiPlan) {
      db.runSync(
        `UPDATE study_materials SET is_dirty = 0, remote_id = ?, aiPlan = ?, module_tag = ? WHERE id = ?`,
        [remoteId, aiPlan, moduleTag ?? null, localId],
      );
    } else {
      db.runSync(
        `UPDATE study_materials SET is_dirty = 0, remote_id = ?, module_tag = ? WHERE id = ?`,
        [remoteId, moduleTag ?? null, localId],
      );
    }
  },

  updateMaterialModuleTag: (userId: string, localId: number, moduleTag: string | null) => {
    const result = db.runSync(
      `UPDATE study_materials SET module_tag = ?, is_dirty = 1 WHERE user_id = ? AND id = ?`,
      [moduleTag ?? null, userId, localId],
    );

    return result.changes;
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
      const existing = db.getFirstSync(
        `SELECT id, is_dirty FROM timetables WHERE user_id = ? AND remote_id = ?`,
        [userId, t.id],
      ) as any;
      if (existing) {
        if (!existing.is_dirty) {
          db.runSync(
            `UPDATE timetables SET title = ?, structuredData = ?, is_deleted = 0 WHERE id = ?`,
            [t.title, JSON.stringify(t.structuredData), existing.id],
          );
        }
        // dirty = local changes win, skip
      } else {
        db.runSync(
          `INSERT INTO timetables (user_id, remote_id, title, structuredData, is_dirty, is_deleted) VALUES (?, ?, ?, ?, 0, 0)`,
          [userId, t.id, t.title, JSON.stringify(t.structuredData)],
        );
      }
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

  // isDirty defaults true - only pass false when syncing inbound from server
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

  // Inbound sync from server - only touches clean rows, never overwrites locally-modified plans
  syncPlansFromServer: (userId: string, plans: any[]) => {
    const remoteDates = plans.map((p) => p.date || p.id);
    // Remove clean local plans that no longer exist on the server
    if (remoteDates.length > 0) {
      const placeholders = remoteDates.map(() => "?").join(",");
      db.runSync(
        `DELETE FROM daily_plans WHERE user_id = ? AND is_dirty = 0 AND date NOT IN (${placeholders})`,
        [userId, ...remoteDates],
      );
    } else {
      db.runSync(`DELETE FROM daily_plans WHERE user_id = ? AND is_dirty = 0`, [userId]);
    }
    for (const p of plans) {
      const date = p.date || p.id;
      const itemsJson = JSON.stringify(p.tasks || p.items || []);
      const existing = db.getFirstSync(
        `SELECT id, is_dirty FROM daily_plans WHERE user_id = ? AND date = ?`,
        [userId, date],
      ) as { id: number; is_dirty: number } | undefined;
      if (existing) {
        // Only overwrite if the local copy is clean
        if (!existing.is_dirty) {
          db.runSync(
            `UPDATE daily_plans SET items_json = ?, is_dirty = 0 WHERE id = ?`,
            [itemsJson, existing.id],
          );
        }
        // is_dirty = 1 means local edits win, skip
      } else {
        db.runSync(
          `INSERT INTO daily_plans (user_id, date, items_json, is_dirty) VALUES (?, ?, ?, 0)`,
          [userId, date, itemsJson],
        );
      }
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

  updateAssignmentDueDate: (
    id: number,
    newDueDate: string,
    newDueTime: string,
  ) => {
    db.runSync(
      `UPDATE assignments SET due_date = ?, due_time = ?, is_dirty = 1 WHERE id = ?`,
      [newDueDate, newDueTime, id],
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
    pendingExtraction = false,
  ) => {
    const result = db.runSync(
      `INSERT INTO assignments (user_id, title, subject, due_date, due_time, priority, rawContent, file_uri, file_type, is_dirty, is_deleted, pending_extraction)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
      [
        userId,
        title,
        subject,
        dueDate,
        "11:59 PM",
        priority,
        rawContent,
        uri || null,
        type || null,
        pendingExtraction ? 1 : 0,
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
        `INSERT INTO assignments (user_id, remote_id, title, subject, due_date, due_time, priority, rawContent, is_dirty, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
         ON CONFLICT(remote_id) DO UPDATE SET
           title = excluded.title,
           subject = excluded.subject,
           due_date = excluded.due_date,
           due_time = excluded.due_time,
           priority = excluded.priority,
           rawContent = excluded.rawContent,
           is_deleted = 0
         WHERE is_dirty = 0`,
        [
          userId,
          a.id,
          a.title,
          a.subject,
          a.due_date,
          a.due_time,
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
        `UPDATE assignments SET is_dirty = 0, pending_extraction = 0, remote_id = ?, title = ?, subject = ?, due_date = ?, due_time = ?, priority = ?, rawContent = ?
         WHERE id = ?`,
        [
          remoteId,
          extraData.title,
          extraData.subject,
          extraData.due_date,
          extraData.due_time,
          extraData.priority,
          extraData.rawContent,
          localId,
        ],
      );
    } else {
      db.runSync(
        `UPDATE assignments SET is_dirty = 0, pending_extraction = 0, remote_id = ? WHERE id = ?`,
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

  logStudyTime: (
    userId: string,
    date: string,
    minutes: number,
    moduleTag?: string,
  ) => {
    db.runSync(
      `INSERT INTO completion_logs (user_id, date, minutes_studied, module_tag, is_dirty)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(user_id, date, module_tag) DO UPDATE SET
       minutes_studied = minutes_studied + ?,
       is_dirty = 1`,
      [userId, date, minutes, moduleTag ?? '', minutes],
    );
  },

  getDirtyCompletionLogs: (userId: string) => {
    return db.getAllSync(
      `SELECT id, date, minutes_studied, module_tag FROM completion_logs
     WHERE user_id = ? AND is_dirty = 1`,
      [userId],
    ) as {
      id: number;
      date: string;
      minutes_studied: number;
      module_tag: string | null;
    }[];
  },

  markCompletionLogsSynced: (userId: string, ids: number[]) => {
    if (!ids.length) return;
    const placeholders = ids.map(() => "?").join(",");
    db.runSync(
      `UPDATE completion_logs SET is_dirty = 0 WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...ids],
    );
  },

  syncCompletionLogsFromServer: (userId: string, logs: any[]) => {
    for (const l of logs) {
      db.runSync(
        `INSERT INTO completion_logs (user_id, date, minutes_studied, module_tag, is_dirty)
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(user_id, date, module_tag) DO UPDATE SET
         minutes_studied = excluded.minutes_studied,
         is_dirty = CASE WHEN is_dirty = 1 THEN 1 ELSE 0 END`,
        [userId, l.date, l.minutes_studied, l.module_tag ?? ''],
      );
    }
  },

  getWeeklyActivity: (userId: string) => {
    return db.getAllSync(
      `SELECT date, minutes_studied FROM completion_logs
       WHERE user_id = ? AND date >= date('now', '-7 days')
       ORDER BY date ASC`,
      [userId],
    );
  },

  getSubjectsFromTimetable: (userId: string): string[] => {
    const rows = db.getAllSync(
      `SELECT structuredData FROM timetables WHERE user_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT 1`,
      [userId],
    ) as { structuredData: string }[];

    if (!rows.length) return [];

    try {
      const data = JSON.parse(rows[0].structuredData);
      const stripTypes = (name: string) =>
        name
          .replace(/\s+(LAB|LECTURE|TUTORIAL|SEMINAR|PRACTICAL)$/i, "")
          .trim();

      const seen = new Set<string>();
      const subjects: string[] = [];

      Object.values(data).forEach((dayEntries: any) => {
        dayEntries.forEach((entry: any) => {
          const clean = stripTypes(entry.subject);
          if (!seen.has(clean)) {
            seen.add(clean);
            subjects.push(clean);
          }
        });
      });

      return subjects.sort();
    } catch {
      return [];
    }
  },

  getModuleStudyHours: (userId: string) => {
    return db.getAllSync(
      `SELECT module_tag, SUM(minutes_studied) as total_minutes
      FROM completion_logs
      WHERE user_id = ? AND module_tag != ''
      AND date >= date('now', '-7 days')
      GROUP BY module_tag
      ORDER BY total_minutes DESC`,
      [userId],
    ) as { module_tag: string; total_minutes: number }[];
  },

  setModuleGoal: (
    userId: string,
    moduleTag: string,
    weeklyGoalMinutes: number,
  ) => {
    db.runSync(
      `INSERT INTO module_goals (user_id, module_tag, weekly_goal_minutes, is_dirty)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(user_id, module_tag) DO UPDATE SET
       weekly_goal_minutes = ?,
       is_dirty = 1`,
      [userId, moduleTag, weeklyGoalMinutes, weeklyGoalMinutes],
    );
  },

  getDirtyModuleGoals: (userId: string) => {
    return db.getAllSync(
      `SELECT module_tag, weekly_goal_minutes FROM module_goals WHERE user_id = ? AND is_dirty = 1`,
      [userId],
    ) as { module_tag: string; weekly_goal_minutes: number }[];
  },

  markModuleGoalsSynced: (userId: string) => {
    db.runSync(`UPDATE module_goals SET is_dirty = 0 WHERE user_id = ?`, [
      userId,
    ]);
  },

  syncModuleGoalsFromServer: (userId: string, goals: any[]) => {
    // Overwrite behavior as remote is truth for synced records
    db.runSync(`DELETE FROM module_goals WHERE user_id = ? AND is_dirty = 0`, [
      userId,
    ]);
    for (const g of goals) {
      db.runSync(
        `INSERT OR REPLACE INTO module_goals (user_id, module_tag, weekly_goal_minutes, is_dirty)
         VALUES (?, ?, ?, 0)`,
        [userId, g.module_tag, g.weekly_goal_minutes],
      );
    }
  },

  getModuleGoals: (userId: string) => {
    return db.getAllSync(
      `SELECT module_tag, weekly_goal_minutes FROM module_goals WHERE user_id = ?`,
      [userId],
    ) as { module_tag: string; weekly_goal_minutes: number }[];
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

  clearUser: (userId: string) => {
    const tables = [
      "user_profile",
      "study_materials",
      "timetables",
      "daily_plans",
      "assignments",
      "flashcards",
      "completion_logs",
      "module_goals",
    ];
    for (const table of tables) {
      const col = table === "user_profile" ? "id" : "user_id";
      db.runSync(`DELETE FROM ${table} WHERE ${col} = ?`, [userId]);
    }
  },
};
