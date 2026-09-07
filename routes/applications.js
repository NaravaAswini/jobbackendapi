const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { queryAll, queryOne, runSql } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/resumes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Setup multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `resume-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/applications - Jobseeker applies for a job with resume
router.post(
  '/',
  authenticateToken,
  requireRole('jobseeker'),
  upload.single('resume'),
  async (req, res) => {
    try {
      const { job_id, applicant_name, applicant_email, applicant_phone, portfolio_url, cover_note } = req.body;

      if (!job_id) {
        return res.status(400).json({ message: 'Job ID is required.' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Resume file is required.' });
      }

      // Check if job exists and is active
      const job = await queryOne('SELECT * FROM jobs WHERE id = ?', [job_id]);
      if (!job) {
        return res.status(404).json({ message: 'Job not found.' });
      }

      if (job.status !== 'active') {
        return res.status(400).json({ message: 'This job posting is no longer active.' });
      }

      // Check if user already applied
      const existingApp = await queryOne(
        'SELECT id FROM applications WHERE job_id = ? AND jobseeker_id = ?',
        [job_id, req.user.id]
      );

      if (existingApp) {
        // Clean up uploaded file if duplicate
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(409).json({ message: 'You have already applied for this job.' });
      }

      const name = applicant_name ? applicant_name.trim() : req.user.name;
      const email = applicant_email ? applicant_email.trim() : req.user.email;

      const result = await runSql(
        `INSERT INTO applications (
          job_id, jobseeker_id, applicant_name, applicant_email, 
          applicant_phone, portfolio_url, cover_note, 
          resume_filename, resume_original_name, resume_path, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Applied')`,
        [
          job_id,
          req.user.id,
          name,
          email,
          applicant_phone ? applicant_phone.trim() : '',
          portfolio_url ? portfolio_url.trim() : '',
          cover_note ? cover_note.trim() : '',
          req.file.filename,
          req.file.originalname,
          req.file.path
        ]
      );

      const newApplication = await queryOne('SELECT * FROM applications WHERE id = ?', [result.lastID]);

      res.status(201).json({
        message: 'Application submitted successfully!',
        application: newApplication
      });
    } catch (err) {
      console.error('Apply job error:', err);
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: err.message || 'Failed to submit application.' });
    }
  }
);

// GET /api/applications/my-applications - Jobseeker views their applied jobs
router.get('/my-applications', authenticateToken, requireRole('jobseeker'), async (req, res) => {
  try {
    const sql = `
      SELECT 
        a.id as application_id,
        a.job_id,
        a.applicant_name,
        a.applicant_email,
        a.applicant_phone,
        a.portfolio_url,
        a.cover_note,
        a.resume_original_name,
        a.status as application_status,
        a.applied_at,
        j.title as job_title,
        j.company as job_company,
        j.location as job_location,
        j.job_type,
        j.salary_range,
        j.experience_level
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE a.jobseeker_id = ?
      ORDER BY a.applied_at DESC
    `;
    const applications = await queryAll(sql, [req.user.id]);
    res.json({ applications });
  } catch (err) {
    console.error('Fetch my applications error:', err);
    res.status(500).json({ message: 'Failed to retrieve applications.' });
  }
});

// GET /api/applications/job/:jobId - Recruiter views all candidates for a job
router.get('/job/:jobId', authenticateToken, requireRole('recruiter'), async (req, res) => {
  try {
    const jobId = req.params.jobId;

    // Verify recruiter owns this job
    const job = await queryOne('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (!job) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    if (job.recruiter_id !== req.user.id) {
      return res.status(403).json({ message: 'You do not have permission to view applicants for this job.' });
    }

    const sql = `
      SELECT 
        a.*,
        u.headline as applicant_headline
      FROM applications a
      LEFT JOIN users u ON a.jobseeker_id = u.id
      WHERE a.job_id = ?
      ORDER BY a.applied_at DESC
    `;
    const applicants = await queryAll(sql, [jobId]);
    res.json({ applicants, job });
  } catch (err) {
    console.error('Fetch job applicants error:', err);
    res.status(500).json({ message: 'Failed to retrieve applicants.' });
  }
});

// PATCH /api/applications/:id/status - Recruiter updates applicant status
router.patch('/:id/status', authenticateToken, requireRole('recruiter'), async (req, res) => {
  try {
    const applicationId = req.params.id;
    const { status } = req.body;

    const validStatuses = ['Applied', 'Reviewing', 'Shortlisted', 'Rejected', 'Hired'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Verify application belongs to a job posted by the recruiter
    const application = await queryOne(
      `SELECT a.*, j.recruiter_id 
       FROM applications a 
       JOIN jobs j ON a.job_id = j.id 
       WHERE a.id = ?`,
      [applicationId]
    );

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    if (application.recruiter_id !== req.user.id) {
      return res.status(403).json({ message: 'Permission denied to update this application.' });
    }

    await runSql('UPDATE applications SET status = ? WHERE id = ?', [status, applicationId]);
    const updated = await queryOne('SELECT * FROM applications WHERE id = ?', [applicationId]);

    res.json({
      message: `Applicant status updated to "${status}"`,
      application: updated
    });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Failed to update applicant status.' });
  }
});

// GET /api/applications/:id/resume - Download or view applicant resume
router.get('/:id/resume', authenticateToken, async (req, res) => {
  try {
    const applicationId = req.params.id;

    const application = await queryOne(
      `SELECT a.*, j.recruiter_id 
       FROM applications a 
       JOIN jobs j ON a.job_id = j.id 
       WHERE a.id = ?`,
      [applicationId]
    );

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    // Allow access if user is either the applicant or the recruiter of the job
    const isApplicant = application.jobseeker_id === req.user.id;
    const isRecruiter = application.recruiter_id === req.user.id;

    if (!isApplicant && !isRecruiter) {
      return res.status(403).json({ message: 'You do not have permission to access this resume.' });
    }

    const filePath = application.resume_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Resume file not found on server.' });
    }

    res.download(filePath, application.resume_original_name);
  } catch (err) {
    console.error('Download resume error:', err);
    res.status(500).json({ message: 'Failed to download resume.' });
  }
});

module.exports = router;
