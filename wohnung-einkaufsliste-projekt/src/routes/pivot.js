const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

router.get("/pivot", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM einkaufsliste ORDER BY raum NULLS LAST, prio ASC, artikel ASC`);

    function buildPivot(items) {
      const raeume = [...new Set(items.map(r => r.raum || "(kein Raum)"))].sort();
      const matrix = {};
      const artikel = {};

      raeume.forEach(raum => {
        matrix[raum] = { 0: 0, 1: 0, 2: 0, 3: 0, gesamt: 0 };
        artikel[raum] = [];
      });

      items.forEach(item => {
        const raum = item.raum || "(kein Raum)";
        const preis = item.status === "gekauft"
          ? parseFloat(item.preis_tatsaechlich || 0)
          : parseFloat(item.preis_planung || 0);
        matrix[raum][item.prio] += preis;
        matrix[raum].gesamt += preis;
        artikel[raum].push(item);
      });

      const spaltensummen = { 0: 0, 1: 0, 2: 0, 3: 0, gesamt: 0 };
      raeume.forEach(raum => {
        [0,1,2,3].forEach(p => { spaltensummen[p] += matrix[raum][p]; });
        spaltensummen.gesamt += matrix[raum].gesamt;
      });

      return { raeume, matrix, artikel, spaltensummen };
    }

    const offen   = buildPivot(rows.filter(r => r.status === "offen"));
    const gekauft = buildPivot(rows.filter(r => r.status === "gekauft"));

    res.render("pivot", { offen, gekauft });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
