const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/jobs - List all active jobs with filtering & search
router.get('/', async (req, res) => {
  try {
    const { search, job_type, category, location, experience_level } = req.query;

    let sql = `
      SELECT 
        j.*,
        u.name as recruiter_name,
        u.email as recruiter_email,
        (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as applications_count
      FROM jobs j
      JOIN users u ON j.recruiter_id = u.id
      WHERE j.status = 'active'
    `;
    const params = [];

    if (search) {
      sql += ` AND (j.title LIKE ? OR j.company LIKE ? OR j.description LIKE ? OR j.requirements LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    if (job_type && job_type !== 'All') {
      sql += ` AND j.job_type = ?`;
      params.push(job_type);
    }

    if (category && category !== 'All') {
      sql += ` AND j.category = ?`;
      params.push(category);
    }

    if (experience_level && experience_level !== 'All') {
      sql += ` AND j.experience_level = ?`;
      params.push(experience_level);
    }

    if (location) {
      sql += ` AND j.location LIKE ?`;
      params.push(`%${location.trim()}%`);
    }

    sql += ` ORDER BY j.created_at DESC`;

    const jobs = await queryAll(sql, params);
    res.json({ jobs });
  } catch (err) {
    console.error('Fetch jobs error:', err);
    res.status(500).json({ message: 'Failed to retrieve jobs.' });
  }
});

// GET /api/jobs/recruiter/my-jobs - Get jobs posted by the logged-in recruiter
router.get('/recruiter/my-jobs', authenticateToken, requireRole('recruiter'), async (req, res) => {
  try {
    const recruiterId = req.user.id;
    const sql = `
      SELECT 
        j.*,
        (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as applications_count
      FROM jobs j
      WHERE j.recruiter_id = ?
      ORDER BY j.created_at DESC
    `;
    const jobs = await queryAll(sql, [recruiterId]);
    res.json({ jobs });
  } catch (err) {
    console.error('Fetch recruiter jobs error:', err);
    res.status(500).json({ message: 'Failed to retrieve recruiter jobs.' });
  }
});

// GET /api/jobs/:id - Get single job details
router.get('/:id', async (req, res) => {
  try {
    const sql = `
      SELECT 
        j.*,
        u.name as recruiter_name,
        u.company as recruiter_company,
        u.email as recruiter_email,
        (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as applications_count
      FROM jobs j
      JOIN users u ON j.recruiter_id = u.id
      WHERE j.id = ?
    `;
    const job = await queryOne(sql, [req.params.id]);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }
    res.json({ job });
  } catch (err) {
    console.error('Fetch job by ID error:', err);
    res.status(500).json({ message: 'Failed to retrieve job details.' });
  }
});

// POST /api/jobs - Recruiter posts a new job
router.post('/', authenticateToken, requireRole('recruiter'), async (req, res) => {
  try {
    const {
      title,
      company,
      location,
      job_type,
      experience_level,
      salary_range,
      category,
      description,
      requirements
    } = req.body;

    if (!title || !company || !location || !job_type || !experience_level || !description) {
      return res.status(400).json({
        message: 'Title, company, location, job type, experience level, and description are required.'
      });
    }

    const sql = `
      INSERT INTO jobs 
        (recruiter_id, title, company, location, job_type, experience_level, salary_range, category, description, requirements, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `;
    const params = [
      req.user.id,
      title.trim(),
      company.trim(),
      location.trim(),
      job_type.trim(),
      experience_level.trim(),
      salary_range ? salary_range.trim() : 'Competitive',
      category ? category.trim() : 'Engineering',
      description.trim(),
      requirements ? requirements.trim() : ''
    ];

    const result = await runSql(sql, params);
    const newJob = await queryOne('SELECT * FROM jobs WHERE id = ?', [result.lastID]);

    res.status(201).json({
      message: 'Job posted successfully!',
      job: newJob
    });
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ message: 'Failed to post new job.' });
  }
});

// PUT /api/jobs/:id - Recruiter updates an existing job
router.put('/:id', authenticateToken, requireRole('recruiter'), async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await queryOne('SELECT * FROM jobs WHERE id = ?', [jobId]);

    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    if (job.recruiter_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only edit jobs you posted.' });
    }

    const {
      title,
      company,
      location,
      job_type,
      experience_level,
      salary_range,
      category,
      description,
      requirements,
      status
    } = req.body;

    const sql = `
      UPDATE jobs SET 
        title = COALESCE(?, title),
        company = COALESCE(?, company),
        location = COALESCE(?, location),
        job_type = COALESCE(?, job_type),
        experience_level = COALESCE(?, experience_level),
        salary_range = COALESCE(?, salary_range),
        category = COALESCE(?, category),
        description = COALESCE(?, description),
        requirements = COALESCE(?, requirements),
        status = COALESCE(?, status)
      WHERE id = ?
    `;

    await runSql(sql, [
      title ? title.trim() : null,
      company ? company.trim() : null,
      location ? location.trim() : null,
      job_type ? job_type.trim() : null,
      experience_level ? experience_level.trim() : null,
      salary_range ? salary_range.trim() : null,
      category ? category.trim() : null,
      description ? description.trim() : null,
      requirements ? requirements.trim() : null,
      status ? status.trim() : null,
      jobId
    ]);

    const updatedJob = await queryOne('SELECT * FROM jobs WHERE id = ?', [jobId]);
    res.json({ message: 'Job updated successfully!', job: updatedJob });
  } catch (err) {
    console.error('Update job error:', err);
    res.status(500).json({ message: 'Failed to update job.' });
  }
});

// DELETE /api/jobs/:id - Recruiter deletes a job
router.delete('/:id', authenticateToken, requireRole('recruiter'), async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await queryOne('SELECT * FROM jobs WHERE id = ?', [jobId]);

    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    if (job.recruiter_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete jobs you posted.' });
    }

    await runSql('DELETE FROM jobs WHERE id = ?', [jobId]);
    res.json({ message: 'Job deleted successfully.' });
  } catch (err) {
    console.error('Delete job error:', err);
    res.status(500).json({ message: 'Failed to delete job.' });
  }
});

module.exports = router;
