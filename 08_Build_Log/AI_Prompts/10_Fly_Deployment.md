---
artifact_id: claude_code_prompt_10_fly_deployment
product: Research Lens
version: 0.1
build_step: BUILD-10
---

# Claude Code Prompt — 10 Fly Deployment

You are implementing BUILD-10 of Research Lens.

## Read first

Read:

- `01_Product_Brief/PRD.md`
- `08_Build_Log/Prototype_Build_Plan.md`

Inspect the current Next.js application and package scripts.

## Objective

Make the existing prototype:

1. reproducibly runnable locally;
2. buildable as a Docker image;
3. deployable to Fly.io;
4. publicly accessible without login;
5. compatible with UI-based Anthropic BYOK.

Do not redesign the application.

## Local requirements

Ensure these work:

```text
npm install
npm run dev
npm run build
npm start
```

Document the expected Node.js version if relevant.

## Docker

Create a simple production Dockerfile appropriate for the current Next.js version.

Prefer a conventional multi-stage build if it materially reduces the image without making the file difficult to understand.

Do not add Docker Compose.

Do not add extra services.

If useful, configure Next.js standalone output, but only if it simplifies deployment.

## Fly.io

Create minimal:

```text
fly.toml
```

for one web application.

Requirements:

- public HTTP/HTTPS;
- internal app port correctly configured;
- no database;
- no Redis;
- no worker process;
- no persistent volume.

Do not create unnecessary Fly resources.

## Secrets

The application uses BYOK.

Therefore a server-side `ANTHROPIC_API_KEY` is not required for normal deployed app usage.

Do not add one merely for deployment.

If the app has non-secret model-name configuration, keep it in source/config unless there is a real reason for an environment variable.

## Security

Confirm:

- user API key is sent only in Analyze requests;
- it is not logged;
- it is not persisted;
- Fly config contains no secret key.

## README

Update or create a concise README covering:

### Local
```text
npm install
npm run dev
```

### Production build
```text
npm run build
npm start
```

### Fly.io
High-level commands such as:

```text
fly launch
fly deploy
```

Do not assume the user wants Claude Code to create the Fly account or change GitHub repository visibility.

## GitHub

The project will live in a private GitHub repository.

Ensure `.gitignore` covers:

- `.env*` where appropriate;
- local secrets;
- build outputs;
- temporary eval results if needed.

Do not push or change the remote unless explicitly instructed.

## Deployment validation

After configuration:

1. run production build locally;
2. build Docker image if Docker is available;
3. report exact Fly deployment command;
4. if Fly CLI/auth is available, deploy and verify the root page;
5. test that deployed app can accept BYOK and call `/api/analyze`.

If credentials/tools are unavailable, stop at a validated deployable configuration and state exactly what remains manual.

## Acceptance criteria

1. Production Next.js build passes.
2. Dockerfile exists and is understandable.
3. `fly.toml` is minimal.
4. No database/service dependencies added.
5. No API key committed.
6. Public app requires no login.
7. README explains local and Fly usage.
8. Existing product behavior is unchanged.

## At completion

Report:

- deployment files added;
- local build result;
- Docker result;
- Fly result if executed;
- public URL if successfully deployed;
- any manual steps remaining.
