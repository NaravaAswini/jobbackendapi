const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryOne, runSql } = require('../db/database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

// In-memory rate limiter for brute-force protection
const loginAttempts = new Map(); // key: ip/email -> { count, lockUntil }
const MAX_ATTEMPTS = 5;
const LOCKOUT_PERIOD_MS = 10 * 60 * 1000; // 10 minutes

const rateLimiter = (req, res, next) => {
  const identifier = req.ip || req.connection.remoteAddress || 'client';
  const record = loginAttempts.get(identifier);

  if (record) {
    if (record.lockUntil && record.lockUntil > Date.now()) {
      const remainingMin = Math.ceil((record.lockUntil - Date.now()) / 60000);
      return res.status(429).json({
        message: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${remainingMin} minute(s).`
      });
    }

    // Reset if lock has expired
    if (record.lockUntil && record.lockUntil <= Date.now()) {
      loginAttempts.delete(identifier);
    }
  }

  next();
};

const recordFailedAttempt = (req) => {
  const identifier = req.ip || req.connection.remoteAddress || 'client';
  const record = loginAttempts.get(identifier) || { count: 0, lockUntil: null };
  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCKOUT_PERIOD_MS;
  }
  loginAttempts.set(identifier, record);
};

const resetAttempts = (req) => {
  const identifier = req.ip || req.connection.remoteAddress || 'client';
  loginAttempts.delete(identifier);
};

// Email validation helper
const isValidEmail = (email) => {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(String(email).toLowerCase());
};

// Password complexity validator: minimum 8 chars, at least 1 uppercase or special char, at least 1 number
const validatePasswordSecurity = (password) => {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password) && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return 'Password must contain at least one number or special character.';
  }
  return null;
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, company, headline } = req.body;

    // Required fields check
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Full name, email, password, and role are required.' });
    }

    const trimmedName = String(name).trim();
    const trimmedEmail = String(email).toLowerCase().trim();

    if (trimmedName.length < 2) {
      return res.status(400).json({ message: 'Full name must be at least 2 characters long.' });
    }

    // Email format validation
    if (!isValidEmail(trimmedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address (e.g. user@domain.com).' });
    }

    // Role validation
    if (!['recruiter', 'jobseeker'].includes(role)) {
      return res.status(400).json({ message: 'Role must be either "recruiter" or "jobseeker".' });
    }

    // If recruiter, company name is required
    if (role === 'recruiter' && (!company || String(company).trim().length === 0)) {
      return res.status(400).json({ message: 'Company name is required for recruiter accounts.' });
    }

    // Password security check
    const passwordError = validatePasswordSecurity(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    // Check if email already registered
    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existing) {
      return res.status(409).json({ message: 'An account with this email address already exists.' });
    }

    // Secure bcrypt hashing (salt rounds: 10)
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await runSql(
      `INSERT INTO users (name, email, password, role, company, headline)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        trimmedName,
        trimmedEmail,
        hashedPassword,
        role,
        company ? String(company).trim() : '',
        headline ? String(headline).trim() : ''
      ]
    );

    const user = {
      id: result.lastID,
      name: trimmedName,
      email: trimmedEmail,
      role,
      company: company ? String(company).trim() : '',
      headline: headline ? String(headline).trim() : ''
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Account registered successfully!',
      user,
      token
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'An error occurred during registration. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', rateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Both email and password are required.' });
    }

    const trimmedEmail = String(email).toLowerCase().trim();

    const userInDb = await queryOne('SELECT * FROM users WHERE email = ?', [trimmedEmail]);
    if (!userInDb) {
      recordFailedAttempt(req);
      return res.status(401).json({ message: 'Invalid email address or password.' });
    }

    const isMatch = await bcrypt.compare(password, userInDb.password);
    if (!isMatch) {
      recordFailedAttempt(req);
      return res.status(401).json({ message: 'Invalid email address or password.' });
    }

    // Reset failed attempts on valid login
    resetAttempts(req);

    const user = {
      id: userInDb.id,
      name: userInDb.name,
      email: userInDb.email,
      role: userInDb.role,
      company: userInDb.company,
      headline: userInDb.headline
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Signed in successfully!',
      user,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'An error occurred during sign-in. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userInDb = await queryOne(
      'SELECT id, name, email, role, company, headline, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!userInDb) {
      return res.status(404).json({ message: 'User profile not found.' });
    }
    res.json({ user: userInDb });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ message: 'Failed to fetch user profile.' });
  }
});

module.exports = router;
