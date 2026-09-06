# Research Lens production image.
#
# Three stages so the runtime carries only what the server actually needs:
# no npm install cache, no devDependencies, no TypeScript compiler, no test
# runner, and no BUILD-9 eval harness.
#
# Node is pinned here rather than in package.json engines, so the deployed
# runtime version is visible in the same file as the rest of the packaging.

# ------------------------------------------------------------------ #
# deps — production + dev dependencies, needed to build
# ------------------------------------------------------------------ #
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

# ------------------------------------------------------------------ #
# builder — compile and prerender
#
# `next build` prerenders `/`, which reads the four Report_*.md files from
# 03_Sample_Data/. Those files are in the build context; Ground_Truth.jsonl,
# the PDFs, the eval harness and the documentation folders are not, because
# .dockerignore keeps them out.
# ------------------------------------------------------------------ #
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ------------------------------------------------------------------ #
# runner — minimal standalone server, non-root
# ------------------------------------------------------------------ #
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

# Standalone output: server.js plus the traced subset of node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Static assets are NOT part of standalone output and must be copied
# separately. Without them the page returns 200 but renders unusable.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The four demo reports, copied file by file rather than by directory so the
# runtime image content stays explicit and auditable.
COPY --from=builder --chown=nextjs:nodejs /app/03_Sample_Data/Report_A_Clean.md ./03_Sample_Data/Report_A_Clean.md
COPY --from=builder --chown=nextjs:nodejs /app/03_Sample_Data/Report_B_Forecast.md ./03_Sample_Data/Report_B_Forecast.md
COPY --from=builder --chown=nextjs:nodejs /app/03_Sample_Data/Report_C_Conflict.md ./03_Sample_Data/Report_C_Conflict.md
COPY --from=builder --chown=nextjs:nodejs /app/03_Sample_Data/Report_D_Failure.md ./03_Sample_Data/Report_D_Failure.md

# There is no public/ directory in this project, so none is copied.

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
