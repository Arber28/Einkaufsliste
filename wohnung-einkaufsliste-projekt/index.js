const express = require("express");
const session = require("express-session");
const path = require("path");
const db = require("./src/db");
const authRoutes = require("./src/routes/auth");
const listRoutes = require("./src/routes/list");
const pivotRoutes = require("./src/routes/pivot");
const app = express();
const PORT = process.env.PORT || 3000;
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
const PgSession = require("connect-pg-simple")(session);
app.use(session({
store: new PgSession({
  pool: db.pool,
  tableName: "user_sessions",
  createTableIfMissing: true
}),
secret: process.env.SESSION_SECRET || "geheimes-wohnungs-geheimnis-2024",
resave: false,
saveUninitialized: false,
rolling: true,
cookie: {
  maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "lax"
}
}));
db.initDB().then(() => {
console.log(" Datenbank bereit");
app.use("/", authRoutes);
app.use("/", listRoutes);
app.use("/", pivotRoutes);

app.use((err, req, res, next) => {
  console.error("Unbehandelter Fehler:", err);
  res.status(500).send("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
});

app.listen(PORT, () => {
console.log(` Server läuft auf Port ${PORT}`);
});
}).catch(err => {
console.error(" DB-Fehler beim Start:", err);
process.exit(1);
});