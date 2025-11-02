import * as SQLite from "expo-sqlite";
export const db = SQLite.openDatabaseSync("brainwave.db");

// Example: create, insert, read
export function init() {
  db.transaction((tx) => {
    tx.executeSql(
      "CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT, duration INTEGER, date TEXT);"
    );
  });
}

export function addSession(subject, duration, date) {
  db.transaction((tx) => {
    tx.executeSql(
      "INSERT INTO sessions (subject, duration, date) VALUES (?, ?, ?);",
      [subject, duration, date]
    );
  });
}

export function getSessions(callback) {
  db.transaction((tx) => {
    tx.executeSql("SELECT * FROM sessions;", [], (_, { rows: { _array } }) =>
      callback(_array)
    );
  });
}
