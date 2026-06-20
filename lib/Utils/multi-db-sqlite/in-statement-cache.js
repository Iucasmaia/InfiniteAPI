/** SQLite default `SQLITE_LIMIT_VARIABLE_NUMBER` is 999. We chunk well below it. */
export const DEFAULT_IN_CHUNK = 500;
export function prepareInClause(db, sqlBeforeIn, sqlAfterIn, chunkSize = DEFAULT_IN_CHUNK) {
    // Cache of prepared statements keyed by exact placeholder count. Holding
    // `Map<number, SqliteStatementLike>` lets us reuse the chunk-sized
    // statement across calls and only prepare a second one for the (at most
    // one) trailing chunk per call.
    const cache = new Map();
    function getStmt(placeholderCount) {
        let stmt = cache.get(placeholderCount);
        if (!stmt) {
            const placeholders = new Array(placeholderCount).fill('?').join(',');
            stmt = db.prepare(`${sqlBeforeIn}${placeholders}${sqlAfterIn}`);
            cache.set(placeholderCount, stmt);
        }
        return stmt;
    }
    return {
        all(leadingParams, inValues) {
            if (inValues.length === 0)
                return [];
            const out = [];
            for (let i = 0; i < inValues.length; i += chunkSize) {
                const chunk = inValues.slice(i, i + chunkSize);
                const stmt = getStmt(chunk.length);
                const rows = stmt.all(...leadingParams, ...chunk);
                if (rows.length > 0)
                    out.push(...rows);
            }
            return out;
        },
        run(leadingParams, inValues) {
            if (inValues.length === 0)
                return 0;
            let total = 0;
            for (let i = 0; i < inValues.length; i += chunkSize) {
                const chunk = inValues.slice(i, i + chunkSize);
                const stmt = getStmt(chunk.length);
                const result = stmt.run(...leadingParams, ...chunk);
                total += result.changes;
            }
            return total;
        }
    };
}
//# sourceMappingURL=in-statement-cache.js.map