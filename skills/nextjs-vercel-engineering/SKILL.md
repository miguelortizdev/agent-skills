---
name: nextjs-vercel-engineering
description: Applies version-aware Next.js engineering practices across App Router, Pages Router, server/client boundaries, performance, security, and deployment. Use when a project contains Next.js or its configuration files.
---

# Next.js / Vercel Engineering

## Overview

Use this skill to make framework-specific decisions while preserving the
project's detected Next.js version and router model. It complements general
testing, security, performance, accessibility, and review Skills; it does not
replace them.

## When to Use

- Building or changing a Next.js route, component, server action, or route handler.
- Reviewing server/client boundaries, caching, revalidation, or data fetching.
- Changing metadata, images, fonts, environment variables, or deployment configuration.
- Investigating bundle size, loading states, error boundaries, SEO, accessibility, or security.

## Process

1. Read `package.json` and identify the installed Next.js, React, and TypeScript versions.
2. Determine whether the project uses `app/`, `pages/`, or both. Do not assume App Router.
3. Preserve server/client boundaries. Add `use client` only when browser interactivity or client-only APIs require it.
4. Check the project's existing caching and revalidation semantics before changing fetches, routes, or server actions.
5. Keep secrets server-side and use only documented environment-variable exposure rules.
6. Preserve loading and error boundaries, metadata, image/font optimization, accessibility, and test coverage.
7. Treat `vercel.json` as Vercel-specific evidence. Do not recommend Vercel-only settings merely because Next.js is present.
8. Verify the result with the repository's existing test, lint, build, and security workflows.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Next.js always means App Router" | Router behavior must be established from the repository. |
| "Vercel is implied by Next.js" | Deployment-specific advice requires Vercel evidence. |
| "This component can be client-side" | Client boundaries increase shipped JavaScript and can expose data. |
| "Caching can be fixed later" | Cache and revalidation choices are part of correctness. |

## Red Flags

- Client components importing server-only modules or secrets.
- APIs or configuration recommended without checking the installed version.
- Unbounded client fetching, accidental static caching, or missing revalidation.
- Missing `loading`, `error`, metadata, accessibility, or image/font considerations.
- Vercel configuration proposed without `vercel.json` or another explicit deployment signal.

## Verification

- [ ] Detected Next.js and React versions were checked.
- [ ] Router and server/client boundaries are explicit.
- [ ] Cache, revalidation, errors, loading, metadata, accessibility, and security were reviewed.
- [ ] Tests and the project's build validation pass.
