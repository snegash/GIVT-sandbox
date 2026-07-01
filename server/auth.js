// server/auth.js — password hashing, JWT, and the auth middleware.
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const secret = () => process.env.JWT_SECRET || "dev-secret-change-me";
const EXPIRES = "7d";

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);
export const signToken = (userId) => jwt.sign({ sub: userId }, secret(), { expiresIn: EXPIRES });

// Express middleware: requires a valid Bearer token, sets req.userId.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.userId = jwt.verify(token, secret()).sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
