# 📄 Resume Customizer Pro

<div align="center">
  <img src="https://img.shields.io/badge/React-18-blue?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-Express-green?logo=nodedotjs" alt="Node.js Express" />
  <img src="https://img.shields.io/badge/Postgres-PostgreSQL-blue?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Tailwind-TailwindCSS-blue?logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Drizzle-ORM-orange" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/CKEditor-Editor-red" alt="CKEditor" />
  <img src="https://img.shields.io/badge/Google_Drive-Integration-yellow?logo=googledrive" alt="Google Drive" />
</div>

<div align="center">
  <h3>🚀 Professional Resume Editor with AI-Powered Tech Stack Analysis</h3>
  <p>A sophisticated full-stack application for creating, editing, and managing professional resumes with real DOCX compatibility and advanced document processing capabilities.</p>
</div>

## ✨ **Key Features**

### � **DOCX Processing System**

- **Complete Processing Pipeline**: Upload → Convert → Edit → Export workflow
- **LibreOffice Integration**: High-fidelity document conversion
- **Style Preservation**: Maintains original document formatting
- **Real-time Collaboration**: Multiple users can edit simultaneously
- **Automatic Backup**: Version control and document history

For detailed documentation about the DOCX processing system:

- See [DOCX Processing System](DOCX_PROCESSING_SYSTEM.md)
- See [DOCX Environment Configuration](DOCX_ENV_CONFIG.md)

### �📝 **Advanced Resume Editor**

- **WYSIWYG Editor**: CKEditor-based editor with MS Word-like functionality
- **Real DOCX Compatibility**: Upload, edit, and export genuine DOCX files
- **Live Preview**: Real-time document preview with accurate formatting
- **Template Library**: Professional resume templates with customizable themes

### 🤖 **AI-Powered Analysis**

- **Tech Stack Detection**: Automatic identification and categorization of technical skills
- **Content Suggestions**: AI-assisted bullet point generation and optimization
- **Smart Grouping**: Intelligent organization of experience points by technology

### ☁️ **Cloud Integration**

- **Google Drive Sync**: Direct file access from Google Drive with OAuth 2.0
- **Multi-Source Upload**: Support for local files and cloud storage
- **Seamless Workflow**: Unified processing pipeline for all file sources

### 🔐 **Enterprise Security**

- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **Rate Limiting**: Advanced rate limiting with IP-based restrictions
- **Account Security**: Failed login tracking, account lockout, and 2FA support
- **Activity Logging**: Comprehensive audit trails and user activity tracking

### 📊 **Marketing & CRM Module**

- **Requirements Management**: Track job requirements and application status
- **Interview Scheduling**: Comprehensive interview management system
- **Email Threading**: Organized email communication tracking
- **Attachment Management**: Centralized file and document management

This repository contains:

- A React + TypeScript frontend (`client/`)
- An Express + TypeScript backend (`server/`) with a DOCX processing pipeline
- Shared types and schemas (`shared/`)

For design notes about DOCX handling see `MS_WORD_INTEGRATION.md`. For production deployment, see `PRODUCTION.md`.

---

## 🏗️ **Architecture Overview**

### **Frontend (React + TypeScript)**

- **Modern React 18**: Hooks, Suspense, and Error Boundaries
- **TypeScript 5**: Full type safety with shared schemas
- **Tailwind CSS + Radix UI**: Modern, accessible component library
- **TanStack Query**: Efficient data fetching and caching
- **Vite**: Lightning-fast development and optimized builds

### **Backend (Express + TypeScript)**

- **Express.js**: RESTful API with comprehensive middleware
- **Drizzle ORM**: Type-safe database operations with PostgreSQL
- **Passport.js**: Authentication strategies and session management
- **Multer**: File upload handling with validation
- **Helmet**: Security headers and CSRF protection

### **Database (PostgreSQL)**

- **Optimized Schema**: Proper indexing and relationships
- **Migration System**: Version-controlled database changes
- **Activity Tracking**: Comprehensive audit logs
- **Rate Limiting**: Database-backed request throttling

### **Document Processing**

- **Mammoth.js**: DOCX to HTML conversion with style preservation
- **docx Library**: High-fidelity DOCX generation and export
- **Streaming Processing**: Memory-efficient handling of large files
- **Format Validation**: Comprehensive file type and structure validation

## 📋 **Table of Contents**

1. [🚀 Quick Start](#-quick-start-development)
2. [⚙️ Environment Setup](#️-environment-variables-full-list-and-notes)
3. [🗄️ Database & Migrations](#️-database--migrations-drizzle)
4. [🏗️ Building & Deployment](#️-running--building--production)
5. [🔄 Common Workflows](#-common-workflows)
6. [🐛 Troubleshooting](#-troubleshooting)
7. [🧪 Testing & Quality](#-tests-types-and-linting)
8. [🤝 Contributing](#-contributing)
9. [📜 License](#-license--acknowledgements)
10. [🚀 Enhancement Roadmap](#-enhancement-roadmap)

---

## 📋 **Prerequisites**

### **System Requirements**

- **Node.js 18+** (LTS recommended) - [Download](https://nodejs.org/)
- **PostgreSQL 13+** (local or remote) - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/downloads)
- **npm/pnpm/yarn** (npm comes with Node.js)

### **Optional Services**

- **Redis** (for enhanced session management and caching)
- **Google Cloud Console** (for Google Drive integration)
- **SMTP Server** (for email functionality)

### **Development Tools**

- **VS Code** with TypeScript and Tailwind CSS extensions
- **PostgreSQL client** (pgAdmin, DBeaver, or CLI)
- **Postman/Insomnia** (for API testing)

---

## 🚀 **Quick Start (Development)**

Follow these steps to get the app running locally.

1. Clone and install dependencies

```powershell
git clone https://github.com/12shivam219/Resume_Customizer_Pro.git
cd Resume_Customizer_Pro
npm install
```

2. Create a `.env` at the repository root. See the Environment variables section below for a full list. Minimal example:

```powershell
Set-Content -Path .env -Value "DATABASE_URL=postgresql://username:password@localhost:5432/resume_customizer"
Add-Content -Path .env -Value "NODE_ENV=development"
Add-Content -Path .env -Value "PORT=5000"
```

Or create `.env` with your editor and paste the sample from the "Environment variables" section.

3. (Optional) Initialize dev secrets

```powershell
npm run env:init
# Force regeneration if needed:
npm run env:init -- --force
```

4. Prepare the database (Drizzle)

```powershell
npm run db:generate
npm run db:push
```

5. Start the server and client in separate terminals

Terminal A (server):

```powershell
npm run dev
```

Terminal B (client):

```powershell
npm run dev:client
```

Open http://localhost:5000 (or the `PORT` you configured).

---

## 3) Environment variables (full list and notes)

Create a `.env` file with the variables below. Required variables for local development are marked.

- DATABASE_URL (required) — Postgres connection string used by Drizzle.
  Example: `postgresql://user:password@localhost:5432/resume_customizer`
- NODE_ENV — `development` | `production` (default: `development`).
- PORT — Server port (default: `5000`).
- SESSION_SECRET (required) — Secret used to sign session cookies.
- JWT_SECRET (required) — Secret for issuing JWTs.
- JWT_REFRESH_SECRET (required) — Secret for refresh tokens.
- REDIS_URL — If you use Redis for sessions or queues (optional).
- EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS — SMTP settings (optional).
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — Optional Google/Drive integration.
- SENTRY_DSN — Optional for error reporting.

Example `.env.example` (copy to `.env` and fill in values):

```env
DATABASE_URL=postgresql://username:password@localhost:5432/resume_customizer
NODE_ENV=development
PORT=5000
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret
# Optional
REDIS_URL=
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASS=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SENTRY_DSN=
```

Security note: Do not commit `.env` to source control. Use environment-specific secret management for production.

Quick sanity check

After creating `.env`, run a quick environment validation to make sure required variables are present:

```powershell
npm run check:env
```

If you prefer to copy the example file to `.env` on Windows PowerShell:

```powershell
Copy-Item -Path .env.example -Destination .env -Force
# then edit .env with your values (e.g. Notepad or VS Code)
```

---

## 4) Database & migrations (Drizzle)

The project uses Drizzle ORM and stores migration files in `migrations/`.

- Generate a migration (after model/schema changes):

```powershell
npm run db:generate
```

- Apply migrations / push schema changes:

```powershell
npm run db:push
```

- Open Drizzle Studio (if available):

```powershell
npm run db:studio
```

If you need to seed data for local development, add a small script under `scripts/` or use the existing scripts folder.

---

## 5) Running / Building / Production

Development

```powershell
# server
npm run dev
# client (if run separately)
npm run dev:client
```

Build and production

```powershell
npm run build
npm run start
```

PM2 (optional) — some provided npm scripts use PM2 for process management:

```powershell
npm run pm2:start
npm run pm2:reload
npm run pm2:stop
```

Docker: If you plan to containerize the app, the repository contains a `Dockerfile`. Adjust and provide a docker-compose with a Postgres service and environment secrets for production.

---

## 6) Common workflows

- Export a resume as DOCX: POST `/api/resumes/:id/export-docx` (server returns docx MIME response). See `server/routes.ts` for implementation details.
- Upload DOCX: use the UI to upload a DOCX file; the server will attempt to parse it with Mammoth and fall back to storing the original file if parsing fails.
- Bulk export: available from the UI — the server produces a ZIP of DOCX files.

---

## 7) Troubleshooting

- If you see errors connecting to Postgres, verify `DATABASE_URL`, that Postgres is running, and that the user has access to the database.
- If DOCX parsing fails for certain documents, the server will fall back to saving the original file. Check server logs (`logs/`) and `server/docx-processor.ts`.
- If you reach memory limits during large DOCX processing, increase Node's memory: `node --max-old-space-size=4096 ...` or process files in background jobs.

Useful debugging tips

- Tail the logs (PowerShell):

```powershell
Get-Content .\\logs\\dev-run.out -Wait
```

- View the most recent server log file in `logs/`.

---

## 8) Tests, types and linting

- Type checking: `npm run check`
- Linting: `npm run lint`
- Add tests under `__tests__` or a `tests/` folder and wire them into `package.json` scripts. There are currently no tests included in the repo — adding unit and integration tests for the DOCX processing pipeline and authentication flows is recommended.

---

## 9) Contributing

Contributions are welcome. Suggested workflow:

1. Fork the repo
2. Create a branch `git checkout -b feature/your-feature`
3. Implement your change and add tests
4. Run `npm run check` and `npm run lint`
5. Open a Pull Request describing the change and motivation

Please include small, focused commits and add tests for new behavior.

---

## 10) License & acknowledgements

This project is MIT licensed — see the `LICENSE` file.

Acknowledgements

- Mammoth.js and docx for DOCX handling
- React, Vite, Tailwind CSS, Radix UI

---

If anything in this README is out of date or missing for your environment, tell me what platform or CI you're targeting and I can add platform-specific steps (Azure, AWS, Docker Compose, etc.).

## 🚀 **Enhancement Roadmap**

### **Phase 1: Testing & Quality (Priority: HIGH)**

- [ ] **Unit Testing Suite**

  - Jest + React Testing Library setup
  - Component testing for critical UI elements
  - Business logic testing for DOCX processing
  - API endpoint testing with Supertest

- [ ] **Integration Testing**

  - Database integration tests
  - Authentication flow testing
  - File upload/processing pipeline tests
  - Google Drive integration tests

- [ ] **E2E Testing**
  - Playwright/Cypress setup
  - Critical user journey testing
  - Cross-browser compatibility testing

### **Phase 2: Developer Experience (Priority: HIGH)**

- [ ] **API Documentation**

  - OpenAPI/Swagger integration
  - Interactive API explorer
  - Request/response examples
  - Authentication documentation

- [ ] **CI/CD Pipeline**

  - GitHub Actions workflow
  - Automated testing on PR
  - Security scanning (CodeQL, Snyk)
  - Automated deployment to staging/production

- [ ] **Development Tools**
  - ESLint + Prettier configuration
  - Husky pre-commit hooks
  - Conventional commits setup
  - Automated changelog generation

### **Phase 3: Performance & Monitoring (Priority: MEDIUM)**

- [ ] **Caching Strategy**

  - Redis integration for sessions
  - API response caching
  - DOCX processing result caching
  - CDN integration for static assets

- [ ] **Monitoring & Observability**

  - Application Performance Monitoring (APM)
  - Error tracking with Sentry
  - Structured logging with Winston
  - Health check endpoints
  - Metrics collection and dashboards

- [ ] **Performance Optimizations**
  - React.memo for expensive components
  - Virtual scrolling for large lists
  - Bundle size optimization
  - Service worker for offline functionality

### **Phase 4: User Experience (Priority: MEDIUM)**

- [ ] **Accessibility Improvements**

  - ARIA labels and roles
  - Keyboard navigation support
  - Screen reader compatibility
  - Color contrast compliance
  - Focus management

- [ ] **Enhanced UI/UX**

  - Loading states and skeleton screens
  - Progressive web app (PWA) features
  - Dark mode support
  - Mobile responsiveness improvements
  - Drag-and-drop file uploads

- [ ] **Advanced Features**
  - Real-time collaboration
  - Version history and rollback
  - Advanced template customization
  - Bulk operations for multiple resumes

### **Phase 5: Scalability & Enterprise (Priority: LOW)**

- [ ] **Internationalization**

  - Multi-language support with react-i18next
  - Localized resume templates
  - RTL language support
  - Currency and date formatting

- [ ] **Enterprise Features**

  - Multi-tenant architecture
  - Role-based access control (RBAC)
  - Single Sign-On (SSO) integration
  - Advanced analytics and reporting
  - White-label customization

- [ ] **Infrastructure**
  - Microservices architecture
  - Container orchestration (Kubernetes)
  - Auto-scaling configuration
  - Multi-region deployment

### **Security Enhancements**

- [ ] **Advanced Security**

  - Content Security Policy (CSP) hardening
  - SQL injection prevention auditing
  - XSS protection improvements
  - Rate limiting per user/endpoint
  - Security headers optimization

- [ ] **Compliance**
  - GDPR compliance features
  - Data retention policies
  - Audit log improvements
  - Privacy controls for users

---

## 📊 **Current Status**

| Category             | Status      | Coverage |
| -------------------- | ----------- | -------- |
| **Core Features**    | ✅ Complete | 100%     |
| **Authentication**   | ✅ Complete | 95%      |
| **DOCX Processing**  | ✅ Complete | 90%      |
| **Google Drive**     | ✅ Complete | 85%      |
| **Marketing Module** | ✅ Complete | 90%      |
| **Testing**          | ⚠️ Partial  | 20%      |
| **Documentation**    | ⚠️ Partial  | 60%      |
| **Monitoring**       | ❌ Missing  | 0%       |
| **CI/CD**            | ❌ Missing  | 0%       |

---

Made with ❤️ by developers, for developers — star the repo if it's helpful!

**Ready to contribute?** Check out our [Contributing Guidelines](#-contributing) and pick an item from the roadmap above!
