const { Pool } = require("pg");
const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
});
async function initDB() {
await pool.query(`
CREATE TABLE IF NOT EXISTS einkaufsliste (
id SERIAL PRIMARY KEY,
artikel TEXT NOT NULL,
raum TEXT,
preis_planung DECIMAL(10,2) DEFAULT 0,
preis_tatsaechlich DECIMAL(10,2) DEFAULT 0,
prio INTEGER DEFAULT 2 CHECK (prio BETWEEN 0 AND 3),
status TEXT DEFAULT 'offen',
ort TEXT DEFAULT 'Österreich',
anmerkungen TEXT,
link TEXT,
erstellt_am TIMESTAMPTZ DEFAULT NOW()
);
`);
await pool.query(`ALTER TABLE einkaufsliste ADD COLUMN IF NOT EXISTS link TEXT;`);
await pool.query(`ALTER TABLE einkaufsliste ADD COLUMN IF NOT EXISTS ort TEXT DEFAULT 'Österreich';`);
await pool.query(`ALTER TABLE einkaufsliste ADD COLUMN IF NOT EXISTS anmerkungen TEXT;`);
await pool.query(`ALTER TABLE einkaufsliste ADD COLUMN IF NOT EXISTS erstellt_am TIMESTAMPTZ DEFAULT NOW();`);
await pool.query(`ALTER TABLE einkaufsliste ADD COLUMN IF NOT EXISTS links TEXT[] DEFAULT '{}';`);
await pool.query(`ALTER TABLE einkaufsliste ADD COLUMN IF NOT EXISTS link_images TEXT[] DEFAULT '{}';`);
await pool.query(`ALTER TABLE einkaufsliste ADD COLUMN IF NOT EXISTS image_path TEXT;`);
await pool.query(`ALTER TABLE einkaufsliste ADD COLUMN IF NOT EXISTS image_paths TEXT[] DEFAULT '{}';`);
await pool.query(`
  UPDATE einkaufsliste
  SET image_paths = ARRAY[image_path]
  WHERE image_path IS NOT NULL AND image_path <> '' AND (image_paths IS NULL OR cardinality(image_paths) = 0);
`);
await pool.query(`
  UPDATE einkaufsliste
  SET links = ARRAY[link]
  WHERE link IS NOT NULL AND link <> '' AND (links IS NULL OR cardinality(links) = 0);
`);
}
module.exports = { pool, initDB };
