import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { hashPassword } from './security.ts';
import type { OpportunityRecord, SafeUser, StudentProfile, UserRecord } from './types.ts';

export class DatabaseUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

export function initDatabase(customPath?: string): Database.Database {
  const dbPath =
    customPath || process.env.DB_PATH || path.join(process.cwd(), 'data', 'proofpath.db');

  if (dbPath === ':memory:' && process.env.NODE_ENV === 'production') {
    throw new DatabaseUnavailableError(
      'In-memory database fallback is prohibited in production. Configure DB_PATH to persistent disk storage.'
    );
  }

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  runMigrations(db);
  seedInitialData(db);
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set<number>(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map(
      (r) => r.version
    )
  );

  if (!applied.has(1)) {
    const migrate1 = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          full_name TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('student', 'moderator', 'admin')) DEFAULT 'student',
          avatar_url TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          preferred_language TEXT NOT NULL CHECK (preferred_language IN ('en', 'bn')) DEFAULT 'en',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          csrf_token TEXT NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS password_resets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          used_at TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS student_profiles (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          nationality TEXT NOT NULL DEFAULT '',
          country_of_residence TEXT NOT NULL DEFAULT '',
          age INTEGER,
          education_level TEXT NOT NULL DEFAULT '',
          gpa REAL,
          gpa_scale REAL NOT NULL DEFAULT 4.0,
          english_proficiency TEXT NOT NULL DEFAULT '',
          english_score TEXT NOT NULL DEFAULT '',
          financial_need TEXT NOT NULL DEFAULT 'any',
          academic_interests_json TEXT NOT NULL DEFAULT '[]',
          target_countries_json TEXT NOT NULL DEFAULT '[]',
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS opportunities (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          organization TEXT NOT NULL,
          country TEXT NOT NULL,
          category TEXT NOT NULL CHECK (category IN ('scholarship', 'internship', 'competition', 'fellowship', 'grant')),
          education_level TEXT NOT NULL CHECK (education_level IN ('high_school', 'undergraduate', 'masters', 'phd', 'all')),
          funding_type TEXT NOT NULL CHECK (funding_type IN ('fully_funded', 'partially_funded', 'paid_stipend', 'prize_pool', 'unfunded')),
          funding_amount TEXT NOT NULL,
          min_gpa REAL,
          english_req TEXT NOT NULL DEFAULT '',
          eligible_nationalities_json TEXT NOT NULL DEFAULT '["All"]',
          min_age INTEGER,
          max_age INTEGER,
          deadline TEXT NOT NULL,
          official_url TEXT NOT NULL,
          description TEXT NOT NULL,
          requirements_json TEXT NOT NULL DEFAULT '[]',
          verification_status TEXT NOT NULL CHECK (verification_status IN ('VERIFIED', 'SUPPORTED', 'CONTRADICTED', 'UNVERIFIED', 'INSUFFICIENT_EVIDENCE', 'EXPIRED')),
          last_verified_at TEXT NOT NULL,
          is_published INTEGER NOT NULL DEFAULT 1,
          created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS verification_reports (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
          input_type TEXT NOT NULL CHECK (input_type IN ('url', 'text', 'file')),
          submitted_url TEXT,
          submitted_title TEXT,
          submitted_text TEXT,
          file_name TEXT,
          file_mime TEXT,
          overall_status TEXT NOT NULL CHECK (overall_status IN ('VERIFIED', 'SUPPORTED', 'CONTRADICTED', 'UNVERIFIED', 'INSUFFICIENT_EVIDENCE', 'EXPIRED')),
          summary TEXT NOT NULL,
          extracted_info_json TEXT NOT NULL,
          claims_json TEXT NOT NULL,
          risk_indicators_json TEXT NOT NULL,
          confidence_limitations TEXT NOT NULL,
          recommended_actions_json TEXT NOT NULL,
          is_saved INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS evidence_records (
          id TEXT PRIMARY KEY,
          report_id TEXT NOT NULL REFERENCES verification_reports(id) ON DELETE CASCADE,
          claim_index INTEGER NOT NULL DEFAULT 0,
          source_url TEXT NOT NULL,
          source_title TEXT NOT NULL,
          excerpt TEXT NOT NULL,
          stance TEXT NOT NULL CHECK (stance IN ('supports', 'contradicts', 'neutral')) DEFAULT 'neutral',
          retrieved_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS saved_opportunities (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL,
          UNIQUE(user_id, opportunity_id)
        );

        CREATE TABLE IF NOT EXISTS applications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
          custom_title TEXT NOT NULL,
          organization TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('researching', 'preparing', 'submitted', 'interview', 'accepted', 'rejected')) DEFAULT 'researching',
          deadline TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          checklist_json TEXT NOT NULL DEFAULT '[]',
          activity_json TEXT NOT NULL DEFAULT '[]',
          priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS application_documents (
          id TEXT PRIMARY KEY,
          application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          doc_name TEXT NOT NULL,
          doc_type TEXT NOT NULL DEFAULT 'document',
          is_ready INTEGER NOT NULL DEFAULT 0,
          file_path TEXT,
          notes TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('deadline', 'verification', 'application', 'security', 'moderation')),
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          link TEXT NOT NULL DEFAULT '/dashboard',
          is_read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notification_preferences (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          in_app_deadlines INTEGER NOT NULL DEFAULT 1,
          in_app_verifications INTEGER NOT NULL DEFAULT 1,
          in_app_applications INTEGER NOT NULL DEFAULT 1,
          in_app_security INTEGER NOT NULL DEFAULT 1,
          deadline_days_before INTEGER NOT NULL DEFAULT 14,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          language TEXT NOT NULL CHECK (language IN ('en', 'bn')) DEFAULT 'en',
          context_opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
          context_report_id TEXT REFERENCES verification_reports(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          grounding_refs_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS community_reports (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
          submitted_url TEXT NOT NULL,
          reason TEXT NOT NULL CHECK (reason IN ('scam_fee', 'phishing', 'expired', 'misleading_terms', 'other')),
          details TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('pending', 'reviewing', 'resolved_valid', 'dismissed')) DEFAULT 'pending',
          reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          resolution_notes TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS moderation_logs (
          id TEXT PRIMARY KEY,
          moderator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          community_report_id TEXT NOT NULL REFERENCES community_reports(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          notes TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS admin_audit_logs (
          id TEXT PRIMARY KEY,
          actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          target_type TEXT NOT NULL,
          target_id TEXT NOT NULL,
          ip_address TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ai_usage_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          feature TEXT NOT NULL,
          model TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('success', 'error', 'rate_limited')),
          latency_ms INTEGER NOT NULL DEFAULT 0,
          tokens_estimated INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS contact_messages (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          subject TEXT NOT NULL,
          message TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('new', 'reviewed')) DEFAULT 'new',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS site_content (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities(category);
        CREATE INDEX IF NOT EXISTS idx_opportunities_country ON opportunities(country);
        CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON opportunities(deadline);
        CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(verification_status);
        CREATE INDEX IF NOT EXISTS idx_reports_user ON verification_reports(user_id);
        CREATE INDEX IF NOT EXISTS idx_reports_created ON verification_reports(created_at);
        CREATE INDEX IF NOT EXISTS idx_evidence_report ON evidence_records(report_id);
        CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
        CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_community_reports_status ON community_reports(status);
        CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_logs(created_at);
      `);

      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        1,
        'initial_enterprise_schema',
        new Date().toISOString()
      );
    });
    migrate1();
  }
}

function seedInitialData(db: Database.Database): void {
  const isProd = process.env.NODE_ENV === 'production';
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const now = new Date().toISOString();

  if (userCount === 0 && !isProd) {
    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, role, avatar_url, is_active, preferred_language, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'en', ?, ?)
    `);

    const studentId = 'usr_student_demo';
    const modId = 'usr_mod_demo';
    const adminId = 'usr_admin_demo';

    insertUser.run(
      studentId,
      'student@proofpath.ai',
      hashPassword('Student@2026!'),
      'Amina Rahman',
      'student',
      '/src/assets/images/avatar_student_lead_1794640632225.jpg',
      now,
      now
    );
    insertUser.run(
      modId,
      'moderator@proofpath.ai',
      hashPassword('Moderator@2026!'),
      'Elena Vance',
      'moderator',
      '/src/assets/images/avatar_admin_analyst_1794640633226.jpg',
      now,
      now
    );
    insertUser.run(
      adminId,
      'admin@proofpath.ai',
      hashPassword('Admin@2026!'),
      'Dr. Marcus Sterling',
      'admin',
      '/src/assets/images/avatar_admin_analyst_1794640633226.jpg',
      now,
      now
    );

    db.prepare(`
      INSERT INTO student_profiles (
        user_id, nationality, country_of_residence, age, education_level, gpa, gpa_scale,
        english_proficiency, english_score, financial_need, academic_interests_json, target_countries_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      studentId,
      'Bangladesh',
      'Bangladesh',
      22,
      'masters',
      3.78,
      4.0,
      'IELTS',
      '7.5',
      'full_funding',
      JSON.stringify(['Computer Science', 'Artificial Intelligence', 'Public Policy']),
      JSON.stringify(['United Kingdom', 'Germany', 'United States', 'Japan']),
      now
    );

    const insertPref = db.prepare(`
      INSERT INTO notification_preferences (user_id, in_app_deadlines, in_app_verifications, in_app_applications, in_app_security, deadline_days_before, updated_at)
      VALUES (?, 1, 1, 1, 1, 14, ?)
    `);
    insertPref.run(studentId, now);
    insertPref.run(modId, now);
    insertPref.run(adminId, now);

    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      'notif_welcome_1',
      studentId,
      'verification',
      'Welcome to ProofPath AI',
      'Your student eligibility profile is ready. Run live verification on any scholarship URL or PDF before applying.',
      '/verify',
      now
    );
  }

  const oppCount = (db.prepare('SELECT COUNT(*) as c FROM opportunities').get() as { c: number }).c;
  if (oppCount === 0) {
    const seedOpps = [
      {
        id: 'opp_chevening',
        slug: 'chevening-uk-government-scholarship',
        title: 'Chevening UK Government Scholarship',
        organization: 'UK Foreign, Commonwealth & Development Office',
        country: 'United Kingdom',
        category: 'scholarship',
        education_level: 'masters',
        funding_type: 'fully_funded',
        funding_amount: 'Full Tuition + £1,347/mo Stipend + Airfare',
        min_gpa: 3.0,
        english_req: 'No fixed test required by Chevening; UK university offer requires IELTS 6.5+',
        eligible_nationalities_json: JSON.stringify(['Bangladesh', 'India', 'Pakistan', 'Nigeria', 'Kenya', 'Indonesia', 'All Chevening Countries']),
        min_age: 18,
        max_age: null,
        deadline: '2027-11-04',
        official_url: 'https://www.chevening.org/scholarships/',
        description: 'Fully funded one-year UK master’s degree scholarship for emerging global leaders with at least two years of work or equivalent experience.',
        requirements_json: JSON.stringify([
          'Undergraduate degree enabling UK master’s admission',
          'At least 2,800 hours (2 years) of work experience',
          'Return to home country for minimum 2 years after award',
          'No application fee on official chevening.org portal',
        ]),
        verification_status: 'VERIFIED',
      },
      {
        id: 'opp_daad_epos',
        slug: 'daad-epos-postgraduate-scholarship',
        title: 'DAAD Development-Related Postgraduate Courses (EPOS)',
        organization: 'German Academic Exchange Service (DAAD)',
        country: 'Germany',
        category: 'scholarship',
        education_level: 'masters',
        funding_type: 'fully_funded',
        funding_amount: '€992/month + Tuition Exemption + Travel Allowance',
        min_gpa: 3.2,
        english_req: 'IELTS 6.0 or TOEFL 80 (varies by German university)',
        eligible_nationalities_json: JSON.stringify(['Bangladesh', 'India', 'Nepal', 'Ghana', 'Kenya', 'Vietnam', 'Developing Countries']),
        min_age: 21,
        max_age: 38,
        deadline: '2027-08-31',
        official_url: 'https://www.daad.de/en/studying-in-germany/scholarships/daad-funding-programmes/',
        description: 'Supports graduates from developing and newly industrialized countries pursuing sustainability, engineering, or public policy postgraduate degrees in Germany.',
        requirements_json: JSON.stringify([
          'Bachelor’s degree normally completed within the last 6 years',
          'Minimum 2 years of professional experience after graduation',
          'Direct application to participating German universities via official DAAD guidelines',
        ]),
        verification_status: 'VERIFIED',
      },
      {
        id: 'opp_erasmus_mundus',
        slug: 'erasmus-mundus-joint-masters',
        title: 'Erasmus Mundus Joint Masters (EMJM) Scholarship',
        organization: 'European Commission / EACEA',
        country: 'European Union',
        category: 'scholarship',
        education_level: 'masters',
        funding_type: 'fully_funded',
        funding_amount: '€1,400/month + Full Tuition + Visa & Travel Support',
        min_gpa: 3.3,
        english_req: 'IELTS 6.5 or TOEFL 90',
        eligible_nationalities_json: JSON.stringify(['All']),
        min_age: null,
        max_age: null,
        deadline: '2027-01-15',
        official_url: 'https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en',
        description: 'International study programme jointly delivered by a consortium of European universities across multiple EU countries with full scholarship coverage.',
        requirements_json: JSON.stringify([
          'First higher education degree (Bachelor’s) before programme start',
          'Apply directly through official consortium catalogue website',
          'Two academic/professional recommendation letters & motivation statement',
        ]),
        verification_status: 'VERIFIED',
      },
      {
        id: 'opp_fulbright_foreign',
        slug: 'fulbright-foreign-student-program',
        title: 'Fulbright Foreign Student Program',
        organization: 'U.S. Department of State & Binational Commissions',
        country: 'United States',
        category: 'fellowship',
        education_level: 'masters',
        funding_type: 'fully_funded',
        funding_amount: 'Full Tuition + Living Stipend + Health Insurance + Airfare',
        min_gpa: 3.3,
        english_req: 'TOEFL 90 or IELTS 7.0',
        eligible_nationalities_json: JSON.stringify(['Bangladesh', 'India', 'Brazil', 'Egypt', 'Indonesia', 'All Partner Countries']),
        min_age: 21,
        max_age: null,
        deadline: '2027-05-15',
        official_url: 'https://foreign.fulbrightonline.org/',
        description: 'Flagship U.S. international educational exchange fellowship enabling graduate students, young professionals, and artists to study in the United States.',
        requirements_json: JSON.stringify([
          'Citizenship of a participating country',
          'Completed Bachelor’s degree with strong academic record',
          'Submit through local U.S. Embassy or Fulbright Commission',
        ]),
        verification_status: 'VERIFIED',
      },
      {
        id: 'opp_gates_cambridge',
        slug: 'gates-cambridge-scholarship',
        title: 'Gates Cambridge Postgraduate Scholarship',
        organization: 'Gates Cambridge Trust / University of Cambridge',
        country: 'United Kingdom',
        category: 'scholarship',
        education_level: 'phd',
        funding_type: 'fully_funded',
        funding_amount: 'Full University Composition Fee + £21,000/yr Stipend',
        min_gpa: 3.7,
        english_req: 'IELTS 7.5 (minimum 7.0 per element)',
        eligible_nationalities_json: JSON.stringify(['All (Non-UK Citizens)']),
        min_age: null,
        max_age: null,
        deadline: '2027-01-05',
        official_url: 'https://www.gatescambridge.org/',
        description: 'Highly selective full-cost postgraduate scholarship for outstanding applicants outside the UK pursuing PhD, MLitt, or one-year postgraduate courses at Cambridge.',
        requirements_json: JSON.stringify([
          'Citizen of any country outside the United Kingdom',
          'Demonstrated academic excellence and leadership capacity',
          'Combined application via Cambridge Postgraduate Admissions Portal',
        ]),
        verification_status: 'VERIFIED',
      },
      {
        id: 'opp_gsoc',
        slug: 'google-summer-of-code',
        title: 'Google Summer of Code (GSoC)',
        organization: 'Google Open Source',
        country: 'Remote / Global',
        category: 'internship',
        education_level: 'all',
        funding_type: 'paid_stipend',
        funding_amount: '$1,500–$6,600 Stipend (PPP-adjusted by country)',
        min_gpa: null,
        english_req: 'Working proficiency in English for mentor collaboration',
        eligible_nationalities_json: JSON.stringify(['All']),
        min_age: 18,
        max_age: null,
        deadline: '2027-04-02',
        official_url: 'https://summerofcode.withgoogle.com/',
        description: 'Global remote open-source software engineering mentorship program connecting university students and beginner contributors with open-source organizations.',
        requirements_json: JSON.stringify([
          'At least 18 years old at registration',
          'Eligible to work in country of residence during coding period',
          'Zero registration fees — never pay third-party prep agencies',
        ]),
        verification_status: 'VERIFIED',
      },
      {
        id: 'opp_mext',
        slug: 'mext-japanese-government-scholarship',
        title: 'MEXT Japanese Government Research Scholarship',
        organization: 'Ministry of Education, Culture, Sports, Science and Technology (Japan)',
        country: 'Japan',
        category: 'scholarship',
        education_level: 'masters',
        funding_type: 'fully_funded',
        funding_amount: '¥143,000–¥145,000/month + Full Tuition + Round-trip Flight',
        min_gpa: 3.2,
        english_req: 'IELTS 6.0 or Japanese Language Proficiency Certificate (program-dependent)',
        eligible_nationalities_json: JSON.stringify(['Bangladesh', 'India', 'Indonesia', 'Malaysia', 'Vietnam', 'All Diplomatic Partner Nations']),
        min_age: 18,
        max_age: 34,
        deadline: '2027-05-25',
        official_url: 'https://www.studyinjapan.go.jp/en/planning/scholarships/mext-scholarships/',
        description: 'Japanese government-funded research, master’s, and doctoral scholarship administered through Japanese Embassies and partner universities.',
        requirements_json: JSON.stringify([
          'Under 35 years of age on April 1 of arrival year',
          'Strong GPA converted on MEXT 3.00 scale (typically >= 2.30/3.00)',
          'Embassy screening includes written exam and interview',
        ]),
        verification_status: 'VERIFIED',
      },
      {
        id: 'opp_cern_summer',
        slug: 'cern-summer-student-programme',
        title: 'CERN Summer Student Programme',
        organization: 'CERN (European Organization for Nuclear Research)',
        country: 'Switzerland',
        category: 'internship',
        education_level: 'undergraduate',
        funding_type: 'paid_stipend',
        funding_amount: 'CHF 93/day Subsistence Allowance + Travel Grant + Insurance',
        min_gpa: 3.3,
        english_req: 'Good working knowledge of English or French',
        eligible_nationalities_json: JSON.stringify(['All']),
        min_age: 18,
        max_age: null,
        deadline: '2027-01-26',
        official_url: 'https://careers.cern/summer',
        description: '8 to 13-week paid on-site research internship in Geneva for undergraduate and master’s students in Physics, Computing, Engineering, and Mathematics.',
        requirements_json: JSON.stringify([
          'Completed at least 3 years of full-time university studies',
          'Remains registered as a student during summer stay',
          'Official applications accepted only on careers.cern',
        ]),
        verification_status: 'VERIFIED',
      },
      {
        id: 'opp_imagine_cup',
        slug: 'microsoft-imagine-cup-global',
        title: 'Microsoft Imagine Cup Global Student Competition',
        organization: 'Microsoft',
        country: 'Global / Hybrid',
        category: 'competition',
        education_level: 'all',
        funding_type: 'prize_pool',
        funding_amount: '$100,000 Grand Prize + Azure Credits + Mentorship',
        min_gpa: null,
        english_req: 'English pitch & technical documentation',
        eligible_nationalities_json: JSON.stringify(['All']),
        min_age: 18,
        max_age: null,
        deadline: '2027-01-22',
        official_url: 'https://imaginecup.microsoft.com/',
        description: 'Premier global student technology startup and AI innovation competition empowering student teams to build cloud-backed social and enterprise products.',
        requirements_json: JSON.stringify([
          'Enrolled student aged 18+ at an accredited institution',
          'Team of up to 4 eligible students',
          'Original software prototype built with cloud/AI architecture',
        ]),
        verification_status: 'SUPPORTED',
      },
      {
        id: 'opp_swiss_excellence',
        slug: 'swiss-government-excellence-scholarships',
        title: 'Swiss Government Excellence Scholarships (FCS)',
        organization: 'Swiss Federal Commission for Scholarships',
        country: 'Switzerland',
        category: 'grant',
        education_level: 'phd',
        funding_type: 'fully_funded',
        funding_amount: 'CHF 1,920/month + Tuition Waiver + Housing Allowance',
        min_gpa: 3.5,
        english_req: 'IELTS 6.5 / University Host Confirmation',
        eligible_nationalities_json: JSON.stringify(['Bangladesh', 'India', 'United States', 'Japan', '180+ Partner Countries']),
        min_age: null,
        max_age: 35,
        deadline: '2026-12-01',
        official_url: 'https://www.sbfi.admin.ch/sbfi/en/home/education/scholarships-and-grants/swiss-government-excellence-scholarships.html',
        description: 'Research, PhD, and postdoctoral fellowships awarded to young researchers from abroad who have completed a master’s degree or PhD.',
        requirements_json: JSON.stringify([
          'Master’s degree completed before July 31',
          'Invitation letter from an academic host professor at a Swiss public university',
          'Submit hardcopy/electronic dossier through Swiss diplomatic representation',
        ]),
        verification_status: 'VERIFIED',
      },
    ];

    const seededAdminId = isProd ? null : 'usr_admin_demo';
    const insertOpp = db.prepare(`
      INSERT INTO opportunities (
        id, slug, title, organization, country, category, education_level, funding_type, funding_amount,
        min_gpa, english_req, eligible_nationalities_json, min_age, max_age, deadline, official_url,
        description, requirements_json, verification_status, last_verified_at, is_published, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);

    for (const o of seedOpps) {
      insertOpp.run(
        o.id,
        o.slug,
        o.title,
        o.organization,
        o.country,
        o.category,
        o.education_level,
        o.funding_type,
        o.funding_amount,
        o.min_gpa,
        o.english_req,
        o.eligible_nationalities_json,
        o.min_age,
        o.max_age,
        o.deadline,
        o.official_url,
        o.description,
        o.requirements_json,
        o.verification_status,
        now,
        seededAdminId,
        now,
        now
      );
    }

    if (!isProd) {
      db.prepare(`
        INSERT OR IGNORE INTO saved_opportunities (id, user_id, opportunity_id, created_at)
        VALUES (?, 'usr_student_demo', 'opp_chevening', ?), (?, 'usr_student_demo', 'opp_erasmus_mundus', ?)
      `).run('sav_1', now, 'sav_2', now);

      db.prepare(`
        INSERT OR IGNORE INTO applications (
          id, user_id, opportunity_id, custom_title, organization, status, deadline, notes, checklist_json, activity_json, priority, created_at, updated_at
        ) VALUES (?, 'usr_student_demo', 'opp_erasmus_mundus', 'Erasmus Mundus Joint Masters (EMJM)', 'European Commission / EACEA', 'preparing', '2027-01-15', ?, ?, ?, 'high', ?, ?)
      `).run(
        'app_seed_1',
        'Targeting EMJMD Artificial Intelligence & Data Engineering consortiums. Verify official consortium portal before uploading transcripts.',
        JSON.stringify([
          { id: 'c1', label: 'Official Bachelor Transcript & Degree Certificate', done: true },
          { id: 'c2', label: 'IELTS 6.5+ Academic Score Report', done: true },
          { id: 'c3', label: 'Two Academic Reference Letters', done: false },
          { id: 'c4', label: 'Statement of Purpose tailored to Consortium', done: false },
        ]),
        JSON.stringify([
          { timestamp: now, action: 'Application added to Preparing stage from Verified Opportunity Directory' },
        ]),
        now,
        now
      );
    }

    // Seed initial public showcase verification report so Public Verification has real DB record
    db.prepare(`
      INSERT OR IGNORE INTO verification_reports (
        id, user_id, opportunity_id, input_type, submitted_url, submitted_title, submitted_text,
        overall_status, summary, extracted_info_json, claims_json, risk_indicators_json,
        confidence_limitations, recommended_actions_json, is_saved, created_at
      ) VALUES (?, ?, 'opp_chevening', 'url', 'https://www.chevening.org/scholarships/', 'Chevening UK Government Scholarship', NULL,
        'VERIFIED', ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      'rep_seed_chevening',
      isProd ? null : 'usr_student_demo',
      'Official UK Foreign, Commonwealth & Development Office domain (chevening.org) verified. No application fees exist on official portals; third-party payment requests indicate fraud.',
      JSON.stringify({
        title: 'Chevening UK Government Scholarship',
        organization: 'UK Foreign, Commonwealth & Development Office',
        country: 'United Kingdom',
        category: 'scholarship',
        deadline: '2027-11-04',
        fundingAmount: 'Full Tuition + Living Stipend + Return Airfare',
        officialUrl: 'https://www.chevening.org/scholarships/',
        feesMentioned: 'None ($0 official application fee)',
      }),
      JSON.stringify([
        {
          claim: 'Chevening is a fully funded UK Government scholarship covering tuition and living costs.',
          verdict: 'VERIFIED',
          explanation: 'Confirmed directly on the official chevening.org scholarship overview and UK FCDO programme guidelines.',
          evidenceExcerpt: 'Chevening Scholarships cover university tuition fees, a monthly living stipend, and travel costs to and from the UK.',
          sourceUrl: 'https://www.chevening.org/scholarships/',
        },
        {
          claim: 'Applicants do not pay any application or processing fee.',
          verdict: 'VERIFIED',
          explanation: 'Official Chevening application portals never charge processing fees.',
          evidenceExcerpt: 'Applying for a Chevening Scholarship is free of charge.',
          sourceUrl: 'https://www.chevening.org/apply/',
        },
      ]),
      JSON.stringify([
        {
          severity: 'low',
          flag: 'Impersonation awareness',
          detail: 'Always verify the browser domain ends strictly in .chevening.org before submitting personal documents.',
        },
      ]),
      'Live deadline windows open annually between August and November; confirm exact cycle opening dates directly on chevening.org.',
      JSON.stringify([
        'Bookmark the official portal https://www.chevening.org/scholarships/',
        'Ignore any agent or email requesting processing fees',
        'Verify 2,800 hours work experience calculation before applying',
      ]),
      now
    );

    db.prepare(`
      INSERT OR IGNORE INTO evidence_records (id, report_id, claim_index, source_url, source_title, excerpt, stance, retrieved_at)
      VALUES (?, 'rep_seed_chevening', 0, 'https://www.chevening.org/scholarships/', 'Chevening Scholarships Official Portal', 'Fully funded UK government scholarships for emerging leaders worldwide.', 'supports', ?)
    `).run('ev_seed_1', now);
  }

  const contentCount = (db.prepare('SELECT COUNT(*) as c FROM site_content').get() as { c: number }).c;
  if (contentCount === 0) {
    db.prepare(`
      INSERT INTO site_content (key, value_json, updated_by, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(
      'landing_announcement',
      JSON.stringify({
        headline: 'Your Future Deserves Verified Opportunities.',
        subheadline:
          'Discover scholarships, fellowships, internships and global opportunities with AI-powered verification, personalized eligibility intelligence, and transparent evidence.',
        trustBanner: 'Zero fabricated evidence. Every verdict cites inspected sources and states confidence limits.',
      }),
      isProd ? null : 'usr_admin_demo',
      now
    );
  }
}

export function mapUserRow(row: UserRecord): SafeUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    avatarUrl: row.avatar_url,
    isActive: row.is_active === 1,
    preferredLanguage: row.preferred_language,
    createdAt: row.created_at,
  };
}

export function mapOpportunityRow(row: Record<string, unknown>): OpportunityRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    organization: String(row.organization),
    country: String(row.country),
    category: row.category as OpportunityRecord['category'],
    educationLevel: row.education_level as OpportunityRecord['educationLevel'],
    fundingType: row.funding_type as OpportunityRecord['fundingType'],
    fundingAmount: String(row.funding_amount),
    minGpa: row.min_gpa === null || row.min_gpa === undefined ? null : Number(row.min_gpa),
    englishReq: String(row.english_req || ''),
    eligibleNationalities: JSON.parse(String(row.eligible_nationalities_json || '["All"]')),
    minAge: row.min_age === null || row.min_age === undefined ? null : Number(row.min_age),
    maxAge: row.max_age === null || row.max_age === undefined ? null : Number(row.max_age),
    deadline: String(row.deadline),
    officialUrl: String(row.official_url),
    description: String(row.description),
    requirements: JSON.parse(String(row.requirements_json || '[]')),
    verificationStatus: row.verification_status as OpportunityRecord['verificationStatus'],
    lastVerifiedAt: String(row.last_verified_at),
    isPublished: Number(row.is_published) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapProfileRow(row: Record<string, unknown> | undefined): StudentProfile | null {
  if (!row) return null;
  return {
    userId: String(row.user_id),
    nationality: String(row.nationality || ''),
    countryOfResidence: String(row.country_of_residence || ''),
    age: row.age === null || row.age === undefined ? null : Number(row.age),
    educationLevel: (row.education_level as StudentProfile['educationLevel']) || '',
    gpa: row.gpa === null || row.gpa === undefined ? null : Number(row.gpa),
    gpaScale: Number(row.gpa_scale || 4.0),
    englishProficiency: String(row.english_proficiency || ''),
    englishScore: String(row.english_score || ''),
    financialNeed: (row.financial_need as StudentProfile['financialNeed']) || 'any',
    academicInterests: JSON.parse(String(row.academic_interests_json || '[]')),
    targetCountries: JSON.parse(String(row.target_countries_json || '[]')),
    updatedAt: String(row.updated_at),
  };
}

export function writeAuditLog(
  db: Database.Database,
  params: {
    actorUserId: string | null;
    action: string;
    targetType: string;
    targetId: string;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  db.prepare(`
    INSERT INTO admin_audit_logs (id, actor_user_id, action, target_type, target_id, ip_address, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud_${crypto.randomUUID()}`,
    params.actorUserId,
    params.action,
    params.targetType,
    params.targetId,
    params.ipAddress || null,
    JSON.stringify(params.metadata || {}),
    new Date().toISOString()
  );
}

export function createNotification(
  db: Database.Database,
  params: {
    userId: string;
    type: 'deadline' | 'verification' | 'application' | 'security' | 'moderation';
    title: string;
    message: string;
    link?: string;
  }
): void {
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    `notif_${crypto.randomUUID()}`,
    params.userId,
    params.type,
    params.title,
    params.message,
    params.link || '/dashboard',
    new Date().toISOString()
  );
}
