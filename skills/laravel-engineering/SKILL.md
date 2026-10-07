---
name: laravel-engineering
description: Applies version-aware Laravel and PHP engineering practices for application structure, Eloquent, validation, queues, authorization, security, and performance. Use when a project contains laravel/framework.
---

# Laravel Engineering

## Overview

Use this skill for Laravel-specific implementation and review. First establish
the Laravel and PHP versions from `composer.json`; do not recommend APIs from a
newer major version without checking the project's constraints.

## When to Use

- Changing controllers, services, Form Requests, policies, resources, or routes.
- Changing Eloquent queries, migrations, transactions, jobs, queues, events, or cache.
- Reviewing configuration, environment variables, exceptions, logging, APIs, testing, or deployment.

## Process

1. Read `composer.json` and identify `laravel/framework`, PHP, and relevant package constraints.
2. Follow the existing application structure and service container conventions instead of moving logic into controllers by default.
3. Validate request data with Form Requests or the established validation boundary; authorize with policies or gates.
4. Inspect Eloquent relationships and query counts for N+1 behavior. Use eager loading intentionally and preserve transaction boundaries.
5. Treat `.env` as secret input. Keep configuration in config files and use the framework's cache, queue, logging, and exception conventions.
6. Protect mass assignment, signed URLs, CSRF, authentication, authorization, and API resource boundaries.
7. Test database behavior, jobs, events, policies, and API responses with the repository's existing test conventions.
8. Verify migrations, queue workers, cache, logging, health checks, and deployment assumptions before shipping.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The latest Laravel API is safe here" | Version constraints determine available APIs. |
| "Eloquent will handle the query count" | Relationship access can create N+1 queries. |
| "Validation in the controller is enough" | Validation and authorization need a clear boundary. |
| "The `.env` value is just configuration" | Environment files commonly contain credentials. |

## Red Flags

- Laravel APIs used without checking the detected major version.
- Controllers containing persistence, authorization, and transaction logic without a reason.
- Lazy relationship access inside loops, unbounded queries, or missing pagination.
- User input used for mass assignment, SQL fragments, file paths, or authorization decisions.
- Jobs or events that are not idempotent or whose failure behavior is untested.

## Verification

- [ ] Laravel and PHP versions were checked.
- [ ] Validation, authorization, transactions, query count, configuration, and secrets were reviewed.
- [ ] Feature/unit tests and migration-sensitive tests pass.
- [ ] Queue, cache, logging, and deployment implications are documented when relevant.
