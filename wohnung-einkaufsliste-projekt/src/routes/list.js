const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../../public/uploads")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2) + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//i.test(file.mimetype)) cb(null, true);
    else cb(new Error("Nur Bilddateien erlaubt"));
  },
});

function normalizeLinks(input) {
  let arr = [];
  if (Array.isArray(input)) arr = input;
  else if (typeof input === "string" && input.trim()) arr = [input];
  return arr.map(s => (s || "").trim()).filter(s => /^https?:\/\//i.test(s));
}

function deleteImageFile(filename) {
  if (!filename) return;
  const p = path.join(__dirname, "../../public/uploads", filename);
  fs.unlink(p, () => {});
}

function deleteImageFiles(filenames) {
  if (!Array.isArray(filenames)) return;
  filenames.forEach(deleteImageFile);
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { status = "alle", sortby = "raum_prio" } = req.query;

    const toArray = v => v === undefined ? [] : (Array.isArray(v) ? v : [v]);
    const raumFilter = toArray(req.query.raum).filter(Boolean);
    const prioFilter = toArray(req.query.prio).filter(v => v !== "");
    const ortFilter  = toArray(req.query.ort).filter(Boolean);

    const raumRows = await pool.query(
      `SELECT DISTINCT raum FROM einkaufsliste WHERE raum IS NOT NULL ORDER BY raum`
    );
    const raeume = raumRows.rows.map(r => r.raum);

    const ortRows = await pool.query(
      `SELECT DISTINCT ort FROM einkaufsliste WHERE ort IS NOT NULL AND ort <> '' ORDER BY ort`
    );
    const orte = ortRows.rows.map(r => r.ort);

    const conditions = [];
    const params = [];

    if (status === "offen" || status === "gekauft") {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (raumFilter.length) {
      const placeholders = raumFilter.map(v => { params.push(v); return `$${params.length}`; });
      conditions.push(`raum IN (${placeholders.join(",")})`);
    }
    if (prioFilter.length) {
      const placeholders = prioFilter.map(v => { params.push(parseInt(v)); return `$${params.length}`; });
      conditions.push(`prio IN (${placeholders.join(",")})`);
    }
    if (ortFilter.length) {
      const placeholders = ortFilter.map(v => { params.push(v); return `$${params.length}`; });
      conditions.push(`ort IN (${placeholders.join(",")})`);
    }

    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const sortMap = {
      raum_prio: "raum NULLS LAST, prio ASC, artikel ASC",
      preis_asc: "preis_planung ASC NULLS LAST",
      preis_desc: "preis_planung DESC NULLS LAST",
      artikel: "artikel ASC",
      prio: "prio ASC, raum NULLS LAST, artikel ASC",
    };
    const orderBy = sortMap[sortby] || sortMap.raum_prio;

    const { rows } = await pool.query(
      `SELECT * FROM einkaufsliste ${where} ORDER BY ${orderBy}`,
      params
    );

    const allRows = await pool.query(`SELECT * FROM einkaufsliste WHERE status = 'gekauft'`);
    const gekauft = allRows.rows;
    const summePlanung = gekauft.reduce((s, r) => s + parseFloat(r.preis_planung || 0), 0);
    const summeTatsaechlich = gekauft.reduce((s, r) => s + parseFloat(r.preis_tatsaechlich || 0), 0);
    const ersparnis = summePlanung - summeTatsaechlich;

    const summeAngezeigt = rows.reduce((s, r) => {
      const tat = parseFloat(r.preis_tatsaechlich || 0);
      const plan = parseFloat(r.preis_planung || 0);
      return s + (r.status === "gekauft" && tat > 0 ? tat : plan);
    }, 0);

    res.render("index", {
      rows,
      ersparnis,
      summePlanung,
      summeTatsaechlich,
      summeAngezeigt,
      raeume,
      orte,
      filter: { status, raum: raumFilter, prio: prioFilter, ort: ortFilter, sortby }
    });
  } catch (err) {
    next(err);
  }
});

router.get("/new", requireAuth, (req, res) => {
  res.render("new", { error: null });
});

router.post("/new", requireAuth, upload.array("bilder", 10), async (req, res, next) => {
  try {
    const { artikel, raum, preis_planung, prio, ort, anmerkungen } = req.body;
    if (!artikel || !artikel.trim()) {
      deleteImageFiles((req.files || []).map(f => f.filename));
      return res.render("new", { error: "Artikel-Name ist ein Pflichtfeld." });
    }
    const prioValue = prio !== undefined && prio !== "" ? parseInt(prio) : 2;
    const links = normalizeLinks(req.body.link);
    const image_paths = (req.files || []).map(f => f.filename);

    await pool.query(
      `INSERT INTO einkaufsliste (artikel, raum, preis_planung, prio, ort, anmerkungen, link, links, image_paths)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        artikel.trim(),
        raum?.trim() || null,
        parseFloat(preis_planung) || 0,
        prioValue,
        ort || "Österreich",
        anmerkungen?.trim() || null,
        links[0] || null,
        links,
        image_paths,
      ]
    );
    res.redirect("/");
  } catch (err) {
    deleteImageFiles((req.files || []).map(f => f.filename));
    next(err);
  }
});

router.get("/edit/:id", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM einkaufsliste WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.redirect("/");
    res.render("edit", { item: rows[0], error: null });
  } catch (err) {
    next(err);
  }
});

router.post("/edit/:id", requireAuth, upload.array("bilder", 10), async (req, res, next) => {
  try {
    const { artikel, raum, preis_planung, preis_tatsaechlich, prio, ort, anmerkungen, status } = req.body;
    if (!artikel || !artikel.trim()) {
      deleteImageFiles((req.files || []).map(f => f.filename));
      const { rows } = await pool.query("SELECT * FROM einkaufsliste WHERE id = $1", [req.params.id]);
      return res.render("edit", { item: rows[0], error: "Artikel-Name ist ein Pflichtfeld." });
    }

    const existing = await pool.query("SELECT links, image_paths FROM einkaufsliste WHERE id = $1", [req.params.id]);
    const oldPaths = existing.rows[0]?.image_paths || [];
    const links = normalizeLinks(req.body.link);
    const prioValue = prio !== undefined && prio !== "" ? parseInt(prio) : 2;

    // Which existing images to delete
    const toDelete = req.body.delete_image
      ? (Array.isArray(req.body.delete_image) ? req.body.delete_image : [req.body.delete_image])
      : [];
    toDelete.forEach(deleteImageFile);

    const keptPaths = oldPaths.filter(p => !toDelete.includes(p));
    const newPaths = (req.files || []).map(f => f.filename);
    const finalPaths = [...keptPaths, ...newPaths];

    await pool.query(
      `UPDATE einkaufsliste SET
        artikel = $1, raum = $2, preis_planung = $3, preis_tatsaechlich = $4,
        prio = $5, ort = $6, anmerkungen = $7, link = $8, status = $9,
        links = $10, image_paths = $11
       WHERE id = $12`,
      [
        artikel.trim(),
        raum?.trim() || null,
        parseFloat(preis_planung) || 0,
        parseFloat(preis_tatsaechlich) || 0,
        prioValue,
        ort || "Österreich",
        anmerkungen?.trim() || null,
        links[0] || null,
        status === "gekauft" ? "gekauft" : "offen",
        links,
        finalPaths,
        req.params.id,
      ]
    );
    res.redirect("/");
  } catch (err) {
    deleteImageFiles((req.files || []).map(f => f.filename));
    next(err);
  }
});

router.post("/kaufen/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { preis_tatsaechlich } = req.body;
    await pool.query(
      `UPDATE einkaufsliste SET status = 'gekauft', preis_tatsaechlich = $1 WHERE id = $2`,
      [parseFloat(preis_tatsaechlich) || 0, id]
    );
    res.redirect("back");
  } catch (err) {
    next(err);
  }
});

router.post("/delete/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await pool.query("SELECT image_paths FROM einkaufsliste WHERE id = $1", [req.params.id]);
    const imgPaths = existing.rows[0]?.image_paths || [];
    await pool.query("DELETE FROM einkaufsliste WHERE id = $1", [req.params.id]);
    deleteImageFiles(imgPaths);
    res.redirect("back");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
