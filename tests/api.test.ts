import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type http from 'node:http';
import { initDatabase } from '../server/db.ts';
import { createApp } from '../server/app.ts';
import { assertSafePublicUrl } from '../server/ssrf.ts';
import { validateMagicBytes } from '../server/security.ts';
import { evaluateEligibility } from '../server/eligibility.ts';
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
