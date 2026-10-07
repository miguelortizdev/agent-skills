---
name: spring-boot-engineering
description: Applies version-aware Spring Boot and Java engineering practices for dependency injection, REST APIs, validation, persistence, security, observability, and testing. Use when a project contains Spring Boot build markers.
---

# Spring Boot Engineering

## Overview

Use this skill for Spring Boot-specific implementation and review. Establish
Spring Boot, Java, and Maven or Gradle versions from the build before choosing
annotations, configuration keys, or dependency APIs.

## When to Use

- Changing controllers, services, repositories, DTOs, validation, or exception handling.
- Changing JPA/Hibernate queries, transactions, configuration profiles, or Actuator.
- Reviewing security, logging, REST contracts, testing, Testcontainers, performance, or deployment.

## Process

1. Inspect `pom.xml`, `build.gradle`, or `build.gradle.kts` for Spring Boot and Java versions.
2. Preserve dependency injection boundaries and keep controllers focused on transport concerns.
3. Validate external input with Bean Validation and return stable error contracts through centralized exception handling.
4. Inspect JPA relationships, fetch plans, transaction boundaries, pagination, and N+1 query risk.
5. Review configuration profiles, externalized secrets, Actuator exposure, logging, metrics, tracing, and health behavior.
6. Apply Spring Security rules at the correct boundary and avoid exposing management endpoints unintentionally.
7. Use focused unit/integration tests and Testcontainers only when an actual dependency boundary requires it.
8. Verify build plugins, migrations, container/runtime settings, readiness, and deployment assumptions for the detected version.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Spring Boot annotations are stable" | Version changes can alter configuration and security behavior. |
| "JPA hides database cost" | Fetch plans and relationship access still determine query volume. |
| "Actuator is harmless" | Management endpoints expose operational data and controls. |
| "A unit test is enough" | Persistence and serialization boundaries need integration coverage. |

## Red Flags

- Spring Boot or Java APIs recommended without checking the build.
- Field injection, hidden service dependencies, or controllers doing persistence work.
- Lazy loading/N+1 queries, missing transaction boundaries, or unbounded REST results.
- Secrets in committed configuration or broad Actuator/security exposure.
- Tests that never exercise serialization, database behavior, or security boundaries.

## Verification

- [ ] Spring Boot, Java, and build tool versions were checked.
- [ ] DI, validation, exception handling, persistence, transactions, security, and observability were reviewed.
- [ ] Build and relevant unit/integration tests pass.
- [ ] Deployment and health behavior match the detected runtime.
