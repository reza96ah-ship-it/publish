# Security Policy — Nashrino (نشرینو)

## Supported Versions

| Version | Support Status |
|---------|---------------|
| Latest production (`main`) | ✅ Active support |
| Previous minor release | ⚠️ Security fixes only (30-day window) |
| All older releases | ❌ No support |

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

We operate a private disclosure process:

1. **Email** `security@nashrino.com` with subject line `[SECURITY] <short description>`.
2. Include:
   - Affected component / endpoint
   - Steps to reproduce (proof-of-concept if available)
   - Impact assessment (what data or accounts could be affected)
   - Your contact info for follow-up
3. Encrypt sensitive reports with our PGP public key (available at `nashrino.com/.well-known/security.txt`).

---

## Response SLA

| Stage | Target |
|-------|--------|
| Acknowledgement | Within **24 hours** of receipt |
| Initial severity triage | Within **72 hours** |
| Patch release (Critical/High) | Within **7 days** of confirmed severity |
| Patch release (Medium) | Within **30 days** |
| Patch release (Low/Informational) | At discretion; included in next regular release |

We will notify you when a fix is released and credit you in the release notes (unless you prefer anonymity).

---

## Scope

**In scope:**
- Authentication and session management (`/api/auth/*`, JWT handling)
- Multi-tenant data isolation (workspace boundary enforcement)
- Social media token storage and transmission
- Content injection (XSS, CSRF, prompt injection via AI routes)
- Authorization bypass or privilege escalation
- PII exposure in logs, error responses, or analytics events
- Third-party integration credential handling (OAuth flows)

**Out of scope:**
- Vulnerabilities in third-party services we use (PostHog, Upstash, AWS S3 — report to them directly)
- Social engineering attacks against employees
- Physical security
- DoS/DDoS (we use infrastructure-level mitigations)
- Issues requiring physical access to user devices

---

## Security Practices

- All social media OAuth tokens are stored encrypted at rest (AES-256-GCM).
- Sessions use JWT with 30-day expiry; MFA (TOTP) is available for admin accounts.
- API routes enforce workspace-scoped authorization on every request.
- Product analytics events are privacy-reviewed; captions, DMs, and personal text are never logged.
- Dependency updates via Dependabot; critical CVEs patched within the response SLA above.
- OWASP ASVS 5.0 is the security baseline target (see GitHub issue #202).

---

## Responsible Disclosure

We follow coordinated disclosure. We ask that you:
- Allow us the full patch SLA before public disclosure.
- Avoid accessing data that does not belong to your own test accounts.
- Do not perform destructive actions (deleting data, sending spam, etc.).

In return, we commit to:
- Responding promptly and keeping you informed.
- Not pursuing legal action for good-faith research within this scope.
- Crediting researchers in our release notes (with consent).

---

*Last updated: 2026-07-03*
