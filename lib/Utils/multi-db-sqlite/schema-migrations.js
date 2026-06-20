const CREATE_BOOKKEEPING_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
`;
/**
 * Applies any pending migrations on `db`. Idempotent — safely re-callable
 * on every open. The bookkeeping table is created on the first call.
 *
 * The function asserts that `migrations` is sorted by `version` and that
 * versions are strictly increasing; violating that is a programmer error
 * (the migration list is hardcoded) and is surfaced as a thrown Error so
 * a typo in the migrations array fails fast rather than silently skipping
 * a step.
 */
export function runMigrations(db, migrations) {
    db.exec(CREATE_BOOKKEEPING_SQL);
    // Sanity-check the migration list once per open.
    for (let i = 1; i < migrations.length; i++) {
        const prev = migrations[i - 1];
        const cur = migrations[i];
        if (cur.version <= prev.version) {
            throw new Error(`runMigrations: migration list is not strictly monotonic — ` +
                `version ${prev.version} ("${prev.name}") is followed by ` +
                `version ${cur.version} ("${cur.name}")`);
        }
    }
    const selectApplied = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC');
    const appliedRows = selectApplied.all();
    const appliedVersions = new Set(appliedRows.map(r => r.version));
    const insertApplied = db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');
    for (const m of migrations) {
        if (appliedVersions.has(m.version))
            continue;
        const tx = db.transaction(() => {
            db.exec(m.sql);
            insertApplied.run(m.version, m.name, Date.now());
        });
        tx.immediate();
    }
}
//# sourceMappingURL=schema-migrations.js.map