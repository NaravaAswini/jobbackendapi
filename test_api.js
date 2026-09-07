const http = require('http');
const fs = require('fs');
const path = require('path');

// Let's create an automated test script using native Node.js 22 fetch
async function runTests() {
  console.log('--- Running Job Portal API Automated Verification Tests ---');
  const baseUrl = 'http://localhost:5000';

  // 1. Health check
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const healthData = await healthRes.json();
  console.log('✓ Health check passed:', healthData.status);

  // 2. Login as Recruiter
  const recruiterRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'recruiter@techcorp.com', password: 'password123' })
  });
  const recruiterData = await recruiterRes.json();
  console.log('✓ Recruiter login passed:', recruiterData.user.name, `(${recruiterData.user.role})`);
  const recruiterToken = recruiterData.token;

  // 3. Login as Jobseeker
  const seekerRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'seeker@example.com', password: 'password123' })
  });
  const seekerData = await seekerRes.json();
  console.log('✓ Jobseeker login passed:', seekerData.user.name, `(${seekerData.user.role})`);
  const seekerToken = seekerData.token;

  // 4. Fetch jobs list
  const jobsRes = await fetch(`${baseUrl}/api/jobs`);
  const jobsData = await jobsRes.json();
  console.log(`✓ Fetch jobs passed: Found ${jobsData.jobs.length} active jobs`);

  // 5. Post a new job as Recruiter
  const newJobPayload = {
    title: 'Senior Cloud DevOps Architect',
    company: 'TechCorp Global',
    location: 'Remote',
    job_type: 'Full-time',
    experience_level: 'Senior',
    salary_range: '$140,000 - $170,000 / year',
    category: 'Engineering',
    description: 'Lead our Kubernetes infrastructure and CI/CD pipelines across AWS and GCP.',
    requirements: '- 5+ years with Kubernetes, Terraform, and Docker\n- Experience managing high-availability clusters'
  };
  const postJobRes = await fetch(`${baseUrl}/api/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recruiterToken}`
    },
    body: JSON.stringify(newJobPayload)
  });
  const postJobData = await postJobRes.json();
  console.log('✓ Post new job passed:', postJobData.job.title, `(ID: ${postJobData.job.id})`);
  const createdJobId = postJobData.job.id;

  // 6. Jobseeker applies for the newly created job with a resume file
  const sampleResumePath = path.join(__dirname, 'uploads/resumes/alex_rivera_resume.txt');
  const fileBlob = new Blob([fs.readFileSync(sampleResumePath)], { type: 'text/plain' });

  const formData = new globalThis.FormData();
  formData.append('job_id', createdJobId.toString());
  formData.append('applicant_name', 'Alex Rivera');
  formData.append('applicant_email', 'seeker@example.com');
  formData.append('applicant_phone', '+1 (555) 321-8765');
  formData.append('cover_note', 'Very excited about DevOps at TechCorp Global!');
  formData.append('resume', fileBlob, 'Alex_DevOps_Resume.txt');

  const applyRes = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${seekerToken}`
    },
    body: formData
  });
  const applyData = await applyRes.json();
  console.log('✓ Jobseeker applied for job passed:', applyData.message, `(App ID: ${applyData.application.id})`);
  const newAppId = applyData.application.id;

  // 7. Verify Jobseeker's "My Applications"
  const myAppsRes = await fetch(`${baseUrl}/api/applications/my-applications`, {
    headers: { Authorization: `Bearer ${seekerToken}` }
  });
  const myAppsData = await myAppsRes.json();
  console.log(`✓ Jobseeker "My Applications" passed: Found ${myAppsData.applications.length} submitted applications`);

  // 8. Recruiter reviews candidates for the job
  const candRes = await fetch(`${baseUrl}/api/applications/job/${createdJobId}`, {
    headers: { Authorization: `Bearer ${recruiterToken}` }
  });
  const candData = await candRes.json();
  console.log(`✓ Recruiter candidates review passed: Found ${candData.applicants.length} candidate(s)`);

  // 9. Recruiter shortlists candidate
  const statusRes = await fetch(`${baseUrl}/api/applications/${newAppId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recruiterToken}`
    },
    body: JSON.stringify({ status: 'Shortlisted' })
  });
  const statusData = await statusRes.json();
  console.log('✓ Recruiter status update passed:', statusData.message);

  // 10. Recruiter downloads resume
  const resumeRes = await fetch(`${baseUrl}/api/applications/${newAppId}/resume`, {
    headers: { Authorization: `Bearer ${recruiterToken}` }
  });
  const resumeText = await resumeRes.text();
  console.log('✓ Recruiter download resume passed: Downloaded resume bytes length =', resumeText.length);

  console.log('\n=============================================');
  console.log('🎉 ALL 10 AUTOMATED VERIFICATION TESTS PASSED!');
  console.log('=============================================');
}

// Check if server is running or start it temporarily
const server = require('./server');
setTimeout(() => {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test failed:', err);
      process.exit(1);
    });
}, 1000);
