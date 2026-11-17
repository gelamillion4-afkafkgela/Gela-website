const jwt = require("jsonwebtoken");

function requireAdmin(req, res, next) {
  const token = req.cookies.dag_admin;
  if (!token || !process.env.JWT_SECRET)
    return res.status(401).json({ error: "Admin login required." });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.clearCookie("dag_admin");
    return res
      .status(401)
      .json({ error: "Your session has expired. Please sign in again." });
  }
}

module.exports = { requireAdmin };