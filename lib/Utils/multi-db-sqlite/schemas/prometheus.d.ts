/**
 * Schema for `prometheus.db` — observability / metrics history.
 *
 * Stores Prometheus-style metrics (counters, gauges, histograms, summaries)
 * for both real-time scraping and historical analysis. Kept in its own
 * physical SQLite file so high-frequency metric writes do not contend with
 * the message-send hot path (`axolotl.db` session storage) or the JID
 * routing tables (`msgstore.db`).
 *
 * Design choices:
 *   - One row per metric sample with `metric_name`, `labels_json`,
 *     `value`, `timestamp`. Querying by name + label set + time range is
 *     covered by composite indexes.
 *   - Sparse `quantiles_json` / `buckets_json` columns hold histogram and
 *     summary distributions without forcing extra tables — easier to scan,
 *     trivial to backfill.
 *   - `retention_seconds` policy is enforced by `prune_old_metrics`
 *     (called by a background ticker, NOT by triggers — triggers fire on
 *     every INSERT and would blow up the write path).
 *
 * Concurrency model:
 *   - `journal_mode = WAL`: readers (scrapers, dashboards) never block the
 *     single writer (metric collector).
 *   - Each instance opens its own connection on `prometheus.db`; better-
 *     sqlite3 serializes writes within a process. Across processes (e.g.
 *     sidecar exporter), `busy_timeout = 5000` absorbs short contention.
 *   - Writes are batched (`BEGIN IMMEDIATE` + N inserts + `COMMIT`) by the
 *     `recordBatch` helper to keep per-sample overhead negligible.
 */
export declare const PROMETHEUS_SCHEMA = "\nCREATE TABLE IF NOT EXISTS metric_samples (\n  _id INTEGER PRIMARY KEY AUTOINCREMENT,\n  metric_name TEXT NOT NULL,\n  metric_type TEXT NOT NULL,\n  labels_json TEXT NOT NULL DEFAULT '{}',\n  value REAL NOT NULL,\n  timestamp INTEGER NOT NULL,\n  buckets_json TEXT,\n  quantiles_json TEXT,\n  sum REAL,\n  count INTEGER\n);\n\nCREATE INDEX IF NOT EXISTS metric_samples_by_name_ts\n  ON metric_samples (metric_name, timestamp DESC);\nCREATE INDEX IF NOT EXISTS metric_samples_by_ts\n  ON metric_samples (timestamp DESC);\nCREATE INDEX IF NOT EXISTS metric_samples_by_name_labels_ts\n  ON metric_samples (metric_name, labels_json, timestamp DESC);\n\nCREATE TABLE IF NOT EXISTS metric_descriptors (\n  metric_name TEXT PRIMARY KEY,\n  metric_type TEXT NOT NULL,\n  help TEXT,\n  unit TEXT,\n  first_seen INTEGER NOT NULL,\n  last_updated INTEGER NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS retention_policies (\n  metric_name TEXT PRIMARY KEY,\n  retention_seconds INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS pruning_log (\n  _id INTEGER PRIMARY KEY AUTOINCREMENT,\n  pruned_at INTEGER NOT NULL,\n  metric_name TEXT,\n  rows_pruned INTEGER NOT NULL,\n  oldest_kept_ts INTEGER\n);\n";
//# sourceMappingURL=prometheus.d.ts.map