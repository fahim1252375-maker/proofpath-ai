import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type http from 'node:http';
import { initDatabase, mapOpportunityRow } from '../server/db.ts';
import { createApp } from '../server/app.ts';
import { assertSafePublicUrl } from '../server/ssrf.ts';
import { validateMagicBytes } from '../server/security.ts';
import { buildTrustProfile, evaluateEligibility } from '../server/eligibility.ts';
import { buildEvidenceRecords } from '../server/ai.ts';
import type Database from 'better-sqlite3';

let server: http.Server;
let baseUrl: string;
let tempDir: string;
let dbPath: string;
let db: Database.Database;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proofpath-test-'));
  dbPath = path.join(tempDir, 'test.db');
  db = initDatabase(dbPath);
  const app = createApp(db);

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr !== 'string') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function extractCookie(res: Response): string {
  const raw = res.headers.get('set-cookie') || '';
  return raw.split(';')[0] || '';
}

describe('ProofPath AI Enterprise API & Security Suite', () => {
  it('returns healthy status and real public statistics', async () => {
    const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json());
    expect(health.status).toBe('ok');
    expect(health.database).toBe('connected');

    const stats = await fetch(`${baseUrl}/api/public/stats`).then((r) => r.json());
    expect(stats.verifiedOpportunities).toBeGreaterThanOrEqual(8);
    expect(stats.countriesCovered).toBeGreaterThanOrEqual(4);
  });

  it('registers a student, enforces auth + CSRF, persists profile & applications across DB reopen', async () => {
    const email = `teststudent_${Date.now()}@example.edu`;
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Test Scholar',
        email,
        password: 'StrongPassword123!',
        preferredLanguage: 'bn',
      }),
    });
    expect(regRes.status).toBe(201);
    const cookie = extractCookie(regRes);
    const regData = await regRes.json();
    expect(regData.user.role).toBe('student');
    expect(regData.csrfToken).toBeTruthy();

    // Duplicate registration fails with 409
    const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Test Scholar',
        email,
        password: 'StrongPassword123!',
      }),
    });
    expect(dupRes.status).toBe(409);

    // State-changing request without CSRF fails with 403
    const noCsrf = await fetch(`${baseUrl}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ nationality: 'Bangladesh' }),
    });
    expect(noCsrf.status).toBe(403);

    // Update profile with CSRF succeeds
    const profRes = await fetch(`${baseUrl}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': regData.csrfToken,
      },
      body: JSON.stringify({
        nationality: 'Bangladesh',
        countryOfResidence: 'Bangladesh',
        age: 23,
        educationLevel: 'masters',
        gpa: 3.8,
        gpaScale: 4.0,
        englishProficiency: 'IELTS',
        englishScore: '7.5',
        financialNeed: 'full_funding',
        academicInterests: ['AI'],
        targetCountries: ['United Kingdom'],
      }),
    });
    expect(profRes.status).toBe(200);

    // Create application
    const appRes = await fetch(`${baseUrl}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': regData.csrfToken,
      },
      body: JSON.stringify({
        customTitle: 'Chevening Application',
        organization: 'UK FCDO',
        status: 'preparing',
        deadline: '2027-11-04',
        priority: 'high',
      }),
    });
    expect(appRes.status).toBe(201);

    // Student cannot access admin routes (403)
    const adminForbidden = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Cookie: cookie },
    });
    expect(adminForbidden.status).toBe(403);

    // Verify persistence on disk by opening second read-only handle
    const dbCheck = initDatabase(dbPath);
    const savedApp = dbCheck
      .prepare('SELECT custom_title FROM applications WHERE custom_title = ?')
      .get('Chevening Application') as { custom_title: string } | undefined;
    expect(savedApp?.custom_title).toBe('Chevening Application');
    dbCheck.close();
  });

  it('maps only retrieved evidence URLs to the specific claims that cite them', () => {
    const claims = [
      {
        claim: 'The program requires an application fee.',
        verdict: 'CONTRADICTED' as const,
        explanation: 'The official source states that applications are free.',
        evidenceExcerpt: 'Applications are free of charge.',
        sourceUrl: 'https://example.org/fees/',
      },
      {
        claim: 'A separate claim cites an invented URL.',
        verdict: 'VERIFIED' as const,
        explanation: 'This source was not returned by retrieval.',
        evidenceExcerpt: 'Unmatched excerpt.',
        sourceUrl: 'https://not-retrieved.example/fake',
      },
      {
        claim: 'The deadline is published on the program page.',
        verdict: 'SUPPORTED' as const,
        explanation: 'A retrieved page contains the deadline.',
        evidenceExcerpt: 'Applications close on 30 June.',
        sourceUrl: 'https://example.org/deadline',
      },
    ];

    const records = buildEvidenceRecords(
      claims,
      [
        { url: 'https://example.org/fees', title: 'Fee policy' },
        { url: 'https://example.org/deadline', title: 'Program deadline' },
      ],
      '2026-11-15T12:00:00.000Z'
    );

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.claimIndex)).toEqual([0, 2]);
    expect(records.map((record) => record.stance)).toEqual(['contradicts', 'supports']);
    expect(records[0].sourceTitle).toBe('Fee policy');
    expect(records[1].excerpt).toContain('30 June');
  });

  it('keeps signed-in verification reports out of the public report feed', async () => {
    const privateReportId = 'rep_private_feed_regression';
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO verification_reports (
        id, user_id, opportunity_id, input_type, submitted_url, submitted_title, submitted_text,
        file_name, file_mime, overall_status, summary, extracted_info_json, claims_json,
        risk_indicators_json, confidence_limitations, recommended_actions_json, is_saved, created_at
      ) VALUES (?, 'usr_student_demo', NULL, 'url', NULL, 'Private regression report', NULL,
        NULL, NULL, 'VERIFIED', 'Private summary', '{}', '[]', '[]', '', '[]', 1, ?)
    `).run(privateReportId, now);

    const publicFeed = await fetch(`${baseUrl}/api/verifications?scope=public`).then((response) => response.json());
    expect(publicFeed.items.some((item: { id: string }) => item.id === privateReportId)).toBe(false);
    expect(publicFeed.items.some((item: { id: string }) => item.id === 'rep_seed_chevening')).toBe(true);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@proofpath.ai', password: 'Student@2026!' }),
    });
    expect(login.status).toBe(200);
    const mine = await fetch(`${baseUrl}/api/verifications?scope=mine`, {
      headers: { Cookie: extractCookie(login) },
    }).then((response) => response.json());
    expect(mine.items.some((item: { id: string }) => item.id === privateReportId)).toBe(true);
  });

  it('describes domain suffixes as signals rather than proof of institutional status', () => {
    const row = db.prepare('SELECT * FROM opportunities WHERE id = ?').get('opp_chevening') as Record<string, unknown>;
    const opportunity = mapOpportunityRow(row);
    const trust = buildTrustProfile(
      { ...opportunity, officialUrl: 'https://sample-foundation.org/program' },
      { reportCount: 0, evidenceCount: 0, flagCount: 0 }
    );

    expect(trust.domainClassification).toContain('nonprofit status is not established');
    expect(trust.domainClassification).not.toContain('Official Foundation');
    expect(trust.riskSummary).toContain('not evidence of safety');
  });

  it('allows an authenticated user to change their password and revokes other sessions', async () => {
    const email = `password_change_${Date.now()}@example.edu`;
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Password Test', email, password: 'OriginalPass123!' }),
    });
    expect(registration.status).toBe(201);
    const registrationData = await registration.json();
    const cookie = extractCookie(registration);
    const userId = registrationData.user.id as string;

    const secondLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'OriginalPass123!' }),
    });
    expect(secondLogin.status).toBe(200);
    const secondCookie = extractCookie(secondLogin);

    const wrongPassword = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': registrationData.csrfToken,
      },
      body: JSON.stringify({ currentPassword: 'WrongPassword!', newPassword: 'NewSecurePass456!' }),
    });
    expect(wrongPassword.status).toBe(400);

    const changed = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': registrationData.csrfToken,
      },
      body: JSON.stringify({ currentPassword: 'OriginalPass123!', newPassword: 'NewSecurePass456!' }),
    });
    expect(changed.status).toBe(200);
    expect((await changed.json()).revokedOtherSessions).toBeGreaterThanOrEqual(1);

    const currentSession = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    const revokedSession = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: secondCookie } });
    expect(currentSession.status).toBe(200);
    expect(revokedSession.status).toBe(200);
    expect((await currentSession.json()).user.id).toBe(userId);
    expect((await revokedSession.json()).user).toBeNull();
  });

  it('supports opportunity search, filtering, and side-by-side comparison', async () => {
    const searchRes = await fetch(`${baseUrl}/api/opportunities?q=Chevening&category=scholarship`).then((r) =>
      r.json()
    );
    expect(searchRes.items.length).toBeGreaterThanOrEqual(1);
    expect(searchRes.items[0].title).toContain('Chevening');

    const cmpRes = await fetch(
      `${baseUrl}/api/opportunities/compare?ids=opp_chevening,opp_erasmus_mundus`
    ).then((r) => r.json());
    expect(cmpRes.items.length).toBe(2);
  });

  it('allows admin login, role management, and writes audit logs', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@proofpath.ai',
        password: 'Admin@2026!',
      }),
    });
    expect(loginRes.status).toBe(200);
    const cookie = extractCookie(loginRes);
    const data = await loginRes.json();
    expect(data.user.role).toBe('admin');

    const createOpportunity = await fetch(`${baseUrl}/api/admin/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': data.csrfToken,
      },
      body: JSON.stringify({
        title: 'Review Pending Opportunity',
        organization: 'Example Institute',
        country: 'Example Country',
        category: 'scholarship',
        educationLevel: 'masters',
        fundingType: 'fully_funded',
        fundingAmount: 'Varies by program',
        deadline: '2027-06-01',
        officialUrl: 'https://example.org/scholarships',
        description: 'A new opportunity awaiting source review.',
      }),
    });
    expect(createOpportunity.status).toBe(201);
    const createdOpportunity = await createOpportunity.json();
    const createdRow = db
      .prepare('SELECT verification_status FROM opportunities WHERE id = ?')
      .get(createdOpportunity.id) as { verification_status: string };
    expect(createdRow.verification_status).toBe('UNVERIFIED');

    const usersRes = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Cookie: cookie },
    });
    expect(usersRes.status).toBe(200);
    const usersJson = await usersRes.json();
    expect(usersJson.items.length).toBeGreaterThanOrEqual(3);

    const auditRes = await fetch(`${baseUrl}/api/admin/audit-logs`, {
      headers: { Cookie: cookie },
    });
    expect(auditRes.status).toBe(200);
    const auditJson = await auditRes.json();
    expect(auditJson.items.some((a: { action: string }) => a.action === 'LOGIN_SUCCESS')).toBe(true);
  });

  it('blocks SSRF private/loopback/metadata URLs and spoofed file magic bytes', async () => {
    await expect(assertSafePublicUrl('http://127.0.0.1:3000/api/health')).rejects.toThrow();
    await expect(assertSafePublicUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow();
    await expect(assertSafePublicUrl('http://localhost:5432')).rejects.toThrow();
    await expect(assertSafePublicUrl('file:///etc/passwd')).rejects.toThrow();

    const apiSsrf = await fetch(`${baseUrl}/api/verify/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://10.0.0.5/internal' }),
    });
    expect(apiSsrf.status).toBe(400);

    // Spoofed PDF check
    const fakePdf = Buffer.from('NOT_A_PDF_SCRIPT');
    expect(validateMagicBytes(fakePdf, 'application/pdf')).toBe(false);
    const realPdf = Buffer.from('%PDF-1.7\n');
    expect(validateMagicBytes(realPdf, 'application/pdf')).toBe(true);
  });

  it('evaluates eligibility accurately without assuming missing fields', () => {
    const opp = db
      .prepare('SELECT * FROM opportunities WHERE id = ?')
      .get('opp_gates_cambridge') as Record<string, unknown>;

    const mappedOpp = {
      id: String(opp.id),
      slug: String(opp.slug),
      title: String(opp.title),
      organization: String(opp.organization),
      country: String(opp.country),
      category: 'scholarship' as const,
      educationLevel: 'phd' as const,
      fundingType: 'fully_funded' as const,
      fundingAmount: String(opp.funding_amount),
      minGpa: 3.7,
      englishReq: 'IELTS 7.5',
      eligibleNationalities: ['All'],
      minAge: null,
      maxAge: null,
      deadline: '2027-01-05',
      officialUrl: String(opp.official_url),
      description: String(opp.description),
      requirements: [],
      verificationStatus: 'VERIFIED' as const,
      lastVerifiedAt: String(opp.last_verified_at),
      isPublished: true,
      createdAt: String(opp.created_at),
      updatedAt: String(opp.updated_at),
    };

    const missingResult = evaluateEligibility(
      {
        userId: 'u1',
        nationality: '',
        countryOfResidence: '',
        age: null,
        educationLevel: '',
        gpa: null,
        gpaScale: 4.0,
        englishProficiency: '',
        englishScore: '',
        financialNeed: 'any',
        academicInterests: [],
        targetCountries: [],
        updatedAt: '',
      },
      mappedOpp
    );
    expect(missingResult.status).toBe('MISSING_INFO');

    const eligibleResult = evaluateEligibility(
      {
        userId: 'u1',
        nationality: 'Bangladesh',
        countryOfResidence: 'Bangladesh',
        age: 24,
        educationLevel: 'phd',
        gpa: 3.9,
        gpaScale: 4.0,
        englishProficiency: 'IELTS',
        englishScore: '8.0',
        financialNeed: 'full_funding',
        academicInterests: ['CS'],
        targetCountries: ['United Kingdom'],
        updatedAt: '',
      },
      mappedOpp
    );
    expect(eligibleResult.status).toBe('ELIGIBLE');
  });

  it('returns matchIntelligence, trustProfile, and ProofPath 2.0 student analytics intelligence', async () => {
    const detailRes = await fetch(`${baseUrl}/api/opportunities/opp_chevening`).then((r) => r.json());
    expect(detailRes.opportunity.trustProfile).toBeDefined();
    expect(detailRes.opportunity.trustProfile.officialDomain).toBe('chevening.org');
    expect(detailRes.opportunity.matchIntelligence).toBeDefined();
    expect(Array.isArray(detailRes.verificationHistory)).toBe(true);

    // Log in as student to verify student analytics intelligence payload
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student@proofpath.ai',
        password: 'Student@2026!',
      }),
    });
    expect(loginRes.status).toBe(200);
    const cookie = extractCookie(loginRes);

    const analytics = await fetch(`${baseUrl}/api/analytics/student`, {
      headers: { Cookie: cookie },
    }).then((r) => r.json());

    expect(analytics.intelligenceScore.totalScore).toBeGreaterThanOrEqual(0);
    expect(analytics.intelligenceScore.totalScore).toBeLessThanOrEqual(100);
    expect(analytics.intelligenceScore.components).toHaveLength(4);
    expect(analytics.personalRadar).toBeDefined();
    expect(analytics.deadlineIntelligence).toHaveProperty('urgent');
    expect(analytics.deadlineIntelligence).toHaveProperty('upcoming');
    expect(analytics.deadlineIntelligence).toHaveProperty('recentlyExpired');
    expect(Array.isArray(analytics.actionCenter)).toBe(true);
  });

  it('blocks demo evaluation account login when NODE_ENV is production', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const blockedRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@proofpath.ai',
          password: 'Admin@2026!',
        }),
      });
      expect(blockedRes.status).toBe(403);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });
});
