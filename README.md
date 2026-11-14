# ProofPath AI 2.0 — Student Opportunity Intelligence, Verification & Protection Platform

ProofPath AI 2.0 is a full-stack TypeScript web application built to help students discover scholarships, fellowships, internships, grants, and competitions while verifying claims against primary sources, computing deterministic eligibility intelligence, and managing applications end-to-end.

## Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS v4 (Warm Ivory / Deep Ink / Electric Lime editorial palette with Light & Dark modes), Lucide icons, client-side PDF export (`jspdf`).
- **Backend**: Express + TypeScript (`server.ts`, `server/app.ts`) with Zod validation, HTTP-only cookie sessions, scrypt password hashing, CSRF protection, sliding-window rate limiting, SSRF network guardrails (`server/ssrf.ts`), and magic-byte file upload validation (`multer`).
- **Database**: Persistent SQLite via `better-sqlite3` (`WAL` mode, foreign keys enforced, idempotent schema migrations in `server/db.ts`).
- **AI Engine**: Server-side `@google/genai` (`gemini-4-hydrogen`) with Google Search grounding, URL Context inspection, multimodal PDF/image/screenshot analysis, bilingual (English & Bangla) context-aware advising, and AI usage telemetry logging (`server/ai.ts`).

## ProofPath AI 2.0 Core Modules

1. **Opportunity Intelligence Score (0–100)**: Transparent weighted scoring across Profile Completeness (30), Verified Match Coverage (30), Application Readiness (25), and Verification Hygiene (15), paired with a Personal Opportunity Radar, Deadline Intelligence (Urgent / Upcoming / Expired), and Personal Action Center.
2. **Evidence Relationship Explorer & Audit History Comparison**: Interactive node-link graph tracing `Submission → Extracted Organization → Claim Nodes → Retrieved Evidence Sources → Verdict`, chronological Audit Timeline, and side-by-side comparison across saved verification reports.
3. **Opportunity Match Intelligence & Trust Profiles**: Personalized funding fit, academic compatibility, deadline urgency, missing-attribute checks, official domain classification, linked verification counts, and community report totals on every opportunity detail page.
4. **Application Intelligence**: Kanban, List, and interactive Monthly Calendar views with real-time Readiness Checklists highlighting missing documents and incomplete steps.

## Database Setup & Models

SQLite persists to `DB_PATH` (defaults to `./data/proofpath.db`). Migrations run automatically on startup across 20 normalized tables:
- `users`, `sessions`, `password_resets`, `student_profiles`
- `opportunities`, `verification_reports`, `evidence_records`, `saved_opportunities`
- `applications`, `application_documents`, `notifications`, `notification_preferences`
- `conversations`, `messages`, `community_reports`, `moderation_logs`
- `admin_audit_logs`, `ai_usage_logs`, `contact_messages`, `site_content`

### Development Evaluation Accounts

Seeded only when `NODE_ENV !== 'production'` and explicitly blocked from signing in when `NODE_ENV === 'production'`:
- **Student**: `student@proofpath.ai` / `Student@2026!`
- **Moderator**: `moderator@proofpath.ai` / `Moderator@2026!`
- **Admin**: `admin@proofpath.ai` / `Admin@2026!`

In production deployments, register standard accounts via `/register` or provision administrators directly on the database.

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `GEMINI_API_KEY`: Server-side Gemini API key (required for live verification & AI advisor).
- `APP_URL`: Public URL of the deployed service.
- `SESSION_SECRET`: Random high-entropy string for HMAC session token hashing.
- `DB_PATH`: Path to persistent SQLite file (e.g., `./data/proofpath.db`).

## Local Development, Testing & Deployment

```bash
npm install
npm run dev      # Starts Express + Vite middleware on port 3000
npm run lint     # TypeScript typecheck
npm test         # Runs Vitest integration & security suite
npm run build    # Builds Vite production bundle to dist/
npm start        # Serves production API + static dist/ via tsx server.ts
```

## Security Controls

- **Authentication**: `crypto.scryptSync` salted password hashing + `crypto.timingSafeEqual` verification, HTTP-only `SameSite=Lax` cookies, and per-session `X-CSRF-Token` validation on state-changing requests. Demo evaluation accounts are disabled in production (`NODE_ENV === 'production'`).
- **SSRF Protection**: Rejects `localhost`, loopback, link-local, cloud metadata (`169.254.169.254`), and private IPv4/IPv6 CIDR ranges before fetching external URLs.
- **Upload Validation**: 10 MB limit, MIME allowlist (`PDF`, `PNG`, `JPEG`, `WEBP`), and binary magic-byte header verification.
- **Role-Based Access Control**: Server-side `requireRole('admin', 'moderator')` enforcement on all administrative and moderation endpoints with persistent `admin_audit_logs`.
