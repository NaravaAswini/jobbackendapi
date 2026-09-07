const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { initDb, queryOne, runSql, queryAll } = require('./database');

async function seed() {
  console.log('Seeding Job Portal database with Indian Rupee (₹) jobs and enhanced roles...');
  await initDb();

  // Ensure upload directory exists and create a sample resume file
  const resumeDir = path.join(__dirname, '../uploads/resumes');
  if (!fs.existsSync(resumeDir)) {
    fs.mkdirSync(resumeDir, { recursive: true });
  }

  const sampleResumePath = path.join(resumeDir, 'alex_rivera_resume.txt');
  if (!fs.existsSync(sampleResumePath)) {
    fs.writeFileSync(
      sampleResumePath,
      `============================================================
ALEX RIVERA — FULL-STACK SOFTWARE ENGINEER
Email: seeker@example.com | Phone: +91 98765 43210
Location: Bengaluru, Karnataka, India | Portfolio: https://alexrivera.dev
============================================================

SUMMARY:
Results-driven Full-Stack Software Engineer with 4+ years of hands-on experience
architecting scalable web applications using React, Node.js, Express, and SQLite/PostgreSQL.

CORE SKILLS:
- Frontend: React 19, Redux Toolkit, Tailwind CSS, TypeScript, Next.js
- Backend: Node.js, Express, REST APIs, Microservices, GraphQL
- Databases: PostgreSQL, SQLite, MongoDB, Redis
- Tools & Cloud: Docker, Git, CI/CD, AWS (S3, EC2, Lambda)

EXPERIENCE:
Senior Frontend Engineer | TechCorp India, Bengaluru (2023 - Present)
- Engineered responsive React applications serving over 300,000 active Indian enterprise users.
- Reduced initial load times by 42% through code splitting, lazy loading, and modern asset bundling.

Software Developer | InnovateX Labs, Pune (2021 - 2023)
- Built resilient backend REST APIs handling over 2M requests daily.
- Integrated Indian payment gateways (Razorpay, UPI) and secured sessions with JWT and bcrypt.

EDUCATION:
B.Tech in Computer Science & Engineering — NIT Trichy (2017 - 2021)
============================================================`
    );
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Seed or Update Recruiter
  let recruiter = await queryOne('SELECT * FROM users WHERE email = ?', ['recruiter@techcorp.com']);
  if (!recruiter) {
    const res = await runSql(
      `INSERT INTO users (name, email, password, role, company, headline)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'Priya Sharma',
        'recruiter@techcorp.com',
        passwordHash,
        'recruiter',
        'TechCorp India',
        'Head of Talent Acquisition & Technical Hiring'
      ]
    );
    recruiter = await queryOne('SELECT * FROM users WHERE id = ?', [res.lastID]);
    console.log('Created Recruiter account: recruiter@techcorp.com (Priya Sharma, TechCorp India)');
  }

  // 2. Seed or Update Jobseeker
  let jobseeker = await queryOne('SELECT * FROM users WHERE email = ?', ['seeker@example.com']);
  if (!jobseeker) {
    const res = await runSql(
      `INSERT INTO users (name, email, password, role, company, headline)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'Rahul Verma',
        'seeker@example.com',
        passwordHash,
        'jobseeker',
        '',
        'Full-Stack Developer | React, Node.js, TypeScript & Cloud'
      ]
    );
    jobseeker = await queryOne('SELECT * FROM users WHERE id = ?', [res.lastID]);
    console.log('Created Jobseeker account: seeker@example.com (Rahul Verma)');
  }

  // Clean existing jobs to reload fresh jobs in ₹ Rupees
  await runSql('DELETE FROM applications');
  await runSql('DELETE FROM jobs');

  // 3. Seed 14 Diverse Jobs across Indian Tech Hubs in INR (₹)
  const sampleJobs = [
    {
      title: 'Senior Full-Stack React & Node.js Developer',
      company: 'TechCorp India',
      location: 'Bengaluru (Hybrid)',
      job_type: 'Full-time',
      experience_level: 'Senior',
      salary_range: '₹18,00,000 - ₹24,00,000 / year (18-24 LPA)',
      category: 'Engineering',
      description: 'TechCorp India is hiring a Senior Full-Stack Engineer to spearhead our next-generation cloud workflow platform. You will build high-performance React frontends, resilient Express/Node microservices, and optimize relational database queries.',
      requirements: '- 4+ years hands-on experience with React, Node.js, and TypeScript\n- Strong proficiency with state management, REST APIs, and SQL databases\n- Experience deploying applications to AWS or Azure'
    },
    {
      title: 'Frontend Engineer (React 19 & Tailwind CSS)',
      company: 'Razorpay Labs',
      location: 'Bengaluru (Remote)',
      job_type: 'Full-time',
      experience_level: 'Mid',
      salary_range: '₹14,00,000 - ₹18,50,000 / year (14-18.5 LPA)',
      category: 'Design & Frontend',
      description: 'Join our merchant checkout frontend team to build lightning-fast, accessible payment interfaces used by millions of shoppers across India every single day.',
      requirements: '- 2-4 years experience building production React interfaces\n- Deep knowledge of modern CSS, Tailwind, responsive design, and browser caching\n- Passion for high accessibility and sub-second load times'
    },
    {
      title: 'Backend Systems Engineer (Python & PostgreSQL)',
      company: 'Swiggy Technologies',
      location: 'Hyderabad (Hybrid)',
      job_type: 'Full-time',
      experience_level: 'Senior',
      salary_range: '₹22,00,000 - ₹28,00,000 / year (22-28 LPA)',
      category: 'Engineering',
      description: 'Drive the real-time logistics and order allocation engine. You will optimize complex dispatch algorithms, manage redis caching layers, and scale microservices for peak delivery traffic.',
      requirements: '- 5+ years backend software development in Python, Go, or Node.js\n- Mastery of relational databases, indexing, and high-concurrency architecture\n- Strong knowledge of Kafka or RabbitMQ messaging'
    },
    {
      title: 'UI/UX Product Designer & Systems Lead',
      company: 'Zomato Design Hub',
      location: 'Gurugram (Gurgaon)',
      job_type: 'Full-time',
      experience_level: 'Senior',
      salary_range: '₹16,00,000 - ₹21,00,000 / year (16-21 LPA)',
      category: 'Product & Design',
      description: 'Lead visual design standards and unified components across mobile apps and web surfaces. Conduct customer usability research and partner with engineering to build reusable design components.',
      requirements: '- 4+ years of product design experience with a stellar Figma portfolio\n- Deep understanding of user research, wireframing, design systems, and usability testing'
    },
    {
      title: 'DevOps & Kubernetes Cloud Specialist',
      company: 'Infosys Cloud Labs',
      location: 'Pune (Remote)',
      job_type: 'Full-time',
      experience_level: 'Senior',
      salary_range: '₹20,00,000 - ₹26,00,000 / year (20-26 LPA)',
      category: 'Engineering',
      description: 'Automate multi-region CI/CD pipelines, container orchestration on EKS/GKE, and implement zero-downtime blue-green deployment strategies for international banking clients.',
      requirements: '- 4+ years in DevOps with Kubernetes, Terraform, Docker, and GitHub Actions\n- Hands-on AWS/GCP cloud architecture and monitoring with Prometheus/Grafana'
    },
    {
      title: 'Junior React & Web Developer Intern',
      company: 'TechCorp India',
      location: 'Bengaluru (Remote)',
      job_type: 'Internship',
      experience_level: 'Entry',
      salary_range: '₹35,00,0 - ₹45,000 / month (Paid Internship)',
      category: 'Engineering',
      description: 'Exceptional opportunity for fresh engineering graduates or self-taught developers. Learn production React workflows, write unit tests, and receive mentorship from principal architects.',
      requirements: '- Solid fundamentals in HTML, CSS, JavaScript (ES6+), and React basics\n- Eager to learn, proactive problem solver, and good team collaborator'
    },
    {
      title: 'Associate Product Manager (Fintech & UPI)',
      company: 'PhonePe',
      location: 'Bengaluru (On-site)',
      job_type: 'Full-time',
      experience_level: 'Mid',
      salary_range: '₹15,00,000 - ₹20,00,000 / year (15-20 LPA)',
      category: 'Product & Design',
      description: 'Collaborate with engineering, analytics, and business stakeholders to define customer journey maps, PRDs, and KPIs for next-gen UPI merchant payments.',
      requirements: '- 2-4 years experience in product management, preferably in fintech or e-commerce\n- Strong analytical skills, SQL proficiency, and data-backed decision making'
    },
    {
      title: 'Data Scientist & Machine Learning Engineer',
      company: 'Tata Consultancy Services',
      location: 'Mumbai (Hybrid)',
      job_type: 'Full-time',
      experience_level: 'Senior',
      salary_range: '₹19,00,000 - ₹25,00,000 / year (19-25 LPA)',
      category: 'Data & Analytics',
      description: 'Build and deploy predictive machine learning models, LLM fine-tuning pipelines, and NLP document extractors for global enterprise clients.',
      requirements: '- 4+ years experience with Python, PyTorch/TensorFlow, scikit-learn, and SQL\n- Experience deploying models to production with FastAPI or Docker'
    },
    {
      title: 'Quality Assurance & Automation Engineer',
      company: 'Flipkart',
      location: 'Bengaluru (Hybrid)',
      job_type: 'Full-time',
      experience_level: 'Mid',
      salary_range: '₹11,00,000 - ₹15,00,000 / year (11-15 LPA)',
      category: 'Engineering',
      description: 'Architect automated end-to-end testing frameworks using Cypress, Playwright, and Selenium to ensure rock-solid stability during the Big Billion Days sale.',
      requirements: '- 3+ years in software test automation for web and API layers\n- Proficiency in JavaScript/TypeScript or Java test scripts with CI/CD integration'
    },
    {
      title: 'Android & iOS Mobile Developer (React Native)',
      company: 'CRED',
      location: 'Bengaluru (On-site)',
      job_type: 'Full-time',
      experience_level: 'Lead',
      salary_range: '₹26,00,000 - ₹34,00,000 / year (26-34 LPA)',
      category: 'Engineering',
      description: 'Craft ultra-smooth 60fps mobile experiences for high-trust financial members. You will optimize native bridging, animations, and offline-first data sync.',
      requirements: '- 5+ years building production mobile apps using React Native or Native iOS/Android\n- Deep obsession with micro-animations, design precision, and app performance'
    },
    {
      title: 'Growth Marketing & SEO Specialist',
      company: 'TechCorp India',
      location: 'Remote (India)',
      job_type: 'Full-time',
      experience_level: 'Mid',
      salary_range: '₹8,50,000 - ₹12,00,000 / year (8.5-12 LPA)',
      category: 'Marketing',
      description: 'Execute organic SEO strategies, technical content distribution, and email nurture funnels to scale incoming B2B SaaS inquiries across domestic and global markets.',
      requirements: '- 3+ years experience in B2B SaaS growth marketing or technical SEO\n- Proven track record growing organic search impressions and conversion rates'
    },
    {
      title: 'Cloud Security & Compliance Engineer',
      company: 'Wipro Cybersecurity',
      location: 'Chennai (Hybrid)',
      job_type: 'Full-time',
      experience_level: 'Senior',
      salary_range: '₹17,00,000 - ₹23,00,000 / year (17-23 LPA)',
      category: 'Engineering',
      description: 'Audit cloud infrastructure, conduct vulnerability scans, and implement SOC2 and ISO27001 compliance guardrails across multi-account AWS environments.',
      requirements: '- 4+ years in cloud security, IAM policies, and penetration testing\n- Relevant certifications (AWS Security Specialty, CISSP, or CEH) preferred'
    }
  ];

  for (const jobData of sampleJobs) {
    const result = await runSql(
      `INSERT INTO jobs (
        recruiter_id, title, company, location, job_type, 
        experience_level, salary_range, category, description, requirements, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        recruiter.id,
        jobData.title,
        jobData.company,
        jobData.location,
        jobData.job_type,
        jobData.experience_level,
        jobData.salary_range,
        jobData.category,
        jobData.description,
        jobData.requirements
      ]
    );
    console.log(`Seeded job in ₹: "${jobData.title}" (${jobData.salary_range})`);
  }

  // 4. Seed an initial application for testing ATS pipeline
  const firstJob = await queryOne('SELECT id FROM jobs WHERE recruiter_id = ? LIMIT 1', [recruiter.id]);
  if (firstJob && jobseeker) {
    await runSql(
      `INSERT INTO applications (
        job_id, jobseeker_id, applicant_name, applicant_email, 
        applicant_phone, portfolio_url, cover_note, 
        resume_filename, resume_original_name, resume_path, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Shortlisted')`,
      [
        firstJob.id,
        jobseeker.id,
        'Rahul Verma',
        'seeker@example.com',
        '+91 98765 43210',
        'https://alexrivera.dev',
        'Excited about scaling the React & Node platform at TechCorp India! I bring 4+ years of full-stack development experience.',
        'alex_rivera_resume.txt',
        'Rahul_Verma_Resume.txt',
        sampleResumePath
      ]
    );
    console.log('Seeded candidate application with Shortlisted status.');
  }

  console.log('✅ Database seeding with 12 Indian Rupee (₹) jobs completed successfully!');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
