---
name: openshift-engineering
description: Reviews and validates OpenShift workloads for rollout safety, security, availability, resource behavior, networking, and observability. Use when OpenShift-specific manifests or API markers are present.
---

# OpenShift Engineering

## Overview

Use this skill for analysis, review, recommendation, and validation of
OpenShift workloads. Do not perform destructive infrastructure changes
automatically. Distinguish OpenShift-specific objects from generic Kubernetes.

## When to Use

- Reviewing Deployments, DeploymentConfig, Services, Routes, ConfigMaps, Secrets references, or ServiceAccounts.
- Reviewing probes, resources, HPA, scheduling, rollout, storage, NetworkPolicy, securityContext, or image behavior.
- Validating operational readiness, scalability, high availability, logging, and observability.

## Process

1. Identify OpenShift API markers and inspect the target manifests without executing cluster or project code.
2. Review workload ownership, Services, Routes, rollout strategy, image tags, pull policy, and storage.
3. Check requests/limits, readiness/liveness/startup probes, HPA, affinity, anti-affinity, tolerations, and disruption behavior.
4. Check ServiceAccounts, securityContext, Secrets/ConfigMaps references, NetworkPolicy awareness, and least privilege.
5. Review logging, metrics, events, rollout visibility, failure recovery, and high-availability assumptions.
6. Report unsafe or destructive recommendations explicitly. Prefer a patch plan or validation result over applying infrastructure changes.
7. Verify manifests with the repository's validation tools and document cluster-specific assumptions.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "A Deployment YAML means OpenShift" | Generic Kubernetes manifests are not OpenShift evidence. |
| "Latest image is convenient" | Mutable tags weaken rollback and reproducibility. |
| "Readiness is optional" | Rollouts and traffic need an accurate readiness signal. |
| "The agent can apply the fix" | Infrastructure changes need explicit review and controlled execution. |

## Red Flags

- Missing or incorrect probes, resource requests, limits, or rollout strategy.
- Privileged securityContext, default ServiceAccount, exposed secrets, or broad network access.
- Mutable image tags, missing pull policy, or no rollback path.
- Routes or Services without clear traffic, TLS, or availability behavior.
- HPA without meaningful resource metrics or workloads without disruption planning.

## Verification

- [ ] OpenShift-specific evidence was distinguished from generic Kubernetes.
- [ ] Workload, security, resources, probes, rollout, networking, storage, and observability were reviewed.
- [ ] No destructive infrastructure action was performed implicitly.
- [ ] Manifest validation and the relevant tests pass.
