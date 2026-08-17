function requireAuth(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect("/login");
}

module.exports = { requireAuth };