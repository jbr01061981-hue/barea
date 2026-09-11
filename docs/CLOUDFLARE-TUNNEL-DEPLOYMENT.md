# BAREA Deployment: Cloudflare Tunnel & Private Node.js Origin (ADR-012)

This document specifies the operational deployment runbook, topology, and configuration contracts for the **BAREA** platform in accordance with [ADR-012](./DECISIONS.md#adr-012-edge-reverse-proxy-and-origin-ingress-trust-boundary).

---

## 1. Architectural Model

```text
PUBLIC CLIENTS (Desktop / Mobile / Projector)
      │
      ▼ (HTTPS / Anycast Edge)
CLOUDFLARE EDGE
      │ • Terminates public TLS 1.3 / 1.2
      │ • Sanitizes incoming client headers
      │ • Sets CF-Connecting-IP
      ▼ (Outbound-only QUIC/TLS tunnel connection)
CLOUDFLARE TUNNEL (`cloudflared` daemon)
      │
      ▼ (Loopback HTTP: 127.0.0.1:3000)
BAREA NODE.JS ORIGIN (Next.js App Router on Node.js 20+)
      │
      ▼
PERSISTENCE (In-process SQLite via node:sqlite / DatabaseSync)
```

### Why This Architecture (and Why Direct Cloudflare Workers is Not Viable)
- **Node.js Native SQLite**: BAREA uses Node's built-in `node:sqlite` (`DatabaseSync`) for ACID-compliant, zero-network-latency transactional persistence across Question Bank, Quiz Management, and Live Quiz Session execution.
- **Workers Incompatibility**: The Cloudflare Workers runtime (`workerd`) does not currently provide a constructible `DatabaseSync` engine. Deploying the BAREA application bundle directly as a Worker script fails because synchronous SQLite storage is unsupported at the edge.
- **Root CommonJS Invariant**: BAREA preserves its CommonJS test and package export contract (`dist/index.js`). It does not use root ESM or experimental edge adapters.
- **Origin Isolation**: The private Node origin binds strictly to loopback (`127.0.0.1:3000`) with zero open public listening ports, completely blocking direct internet port scans or direct HTTP header spoofing.

---

## 2. Origin Configuration & Production Process

### Prerequisites
- Node.js `^20.0.0` or `^24.0.0` (verified on Node `v24.18.0`).
- Dedicated user/service account on the host (e.g. `barea`).

### Origin Host Commands
1. Install dependencies:
   ```bash
   npm ci
   ```
2. Build the TypeScript core and Next.js distribution:
   ```bash
   npm run build
   npm run build:next
   ```
3. Start the production origin process (strictly on loopback):
   ```bash
   npm run start
   # Executes: next start -H 127.0.0.1 -p 3000
   ```

---

## 3. Cloudflare Tunnel (`cloudflared`) Configuration

The `cloudflared` daemon runs as an outbound-only service connecting the private host to Cloudflare Edge.

### A. Configuration File (`/etc/cloudflared/config.yml`)
```yaml
tunnel: <CLOUDFLARE_TUNNEL_UUID>
credentials-file: /etc/cloudflared/<CLOUDFLARE_TUNNEL_UUID>.json

ingress:
  - hostname: quiz-staging.yourchurch.org
    service: http://127.0.0.1:3000
  - service: http_status:404
```

### B. Environment-Driven Execution (Docker / Systemd)
Alternatively, `cloudflared` can run using the tunnel token without a local credentials file:
```bash
cloudflared tunnel run --token $CLOUDFLARE_TUNNEL_TOKEN
```

---

## 4. Environment Variables & Secret Management

Secrets must **NEVER** be committed to Git. Store them in secure host environment files (e.g. `/etc/barea/production.env` with `chmod 600`) or cloud secret managers.

| Variable Name | Scope | Description |
| :--- | :--- | :--- |
| `CLOUDFLARE_TUNNEL_TOKEN` | Edge / Tunnel | High-entropy connector token issued by Cloudflare Zero Trust. |
| `BAREA_DEV_ORG_ID` | Application | Development organization ID for local development and non-production testing. |
| `BAREA_DEV_USER_ID` | Application | Development user ID for local non-production testing. |
| `BAREA_DB_PATH` | Application | Optional custom path for the SQLite database file (defaults to `barea.db` in cwd). |
| `GEMINI_API_KEY` | Application | Optional API key for Google Gemini AI generation in Question Bank. |
| `BAREA_EDGE_SECRET` | Edge & App | Optional static shared secret for defense-in-depth header verification. |

---

## 5. Deployment Verification Checklist

When provisioning a new host or staging environment, execute these checks:

1. **Origin Loopback Verification**:
   ```bash
   curl -I http://127.0.0.1:3000/
   # Must respond 200 OK or 307 Redirect (to /teacher/review)
   ```
2. **Origin Public Inaccessibility (Direct Origin Attack Simulation)**:
   ```bash
   curl -I http://<PUBLIC_HOST_IP>:3000/
   # Connection MUST be refused, timed out, or dropped by firewall
   ```
3. **Tunnel Connectivity**:
   ```bash
   cloudflared tunnel info <CLOUDFLARE_TUNNEL_UUID>
   # Must show active connectors connected to edge PoPs
   ```
4. **Public HTTPS Edge Verification**:
   ```bash
   curl -I https://quiz-staging.yourchurch.org/
   # Must negotiate TLS at edge and proxy seamlessly to loopback origin
   ```
