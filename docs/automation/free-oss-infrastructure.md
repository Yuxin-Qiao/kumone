# Free OSS infrastructure map

Kumone deliberately outsources repeatable maintenance work to free/open-source infrastructure. Deterministic GitHub Actions remain the final authority; external bots may report, propose, test or sign, but they do not bypass repository gates.

## Active in-repository automation

| Layer | Implementation | Trust model |
| --- | --- | --- |
| Upstream maintenance | Semantic Upstream Sync | Immutable candidate SHA, ownership-aware conflicts, fail-closed auto-merge |
| Dependency maintenance | Self-hosted Renovate | Only Cargo/Gradle/npm/GitHub Actions/Docker managers; major updates stay fail-closed |
| Dependency auto-merge | `dependency-bot-automerge.yml` | Requires `automerge-safe`, clean/up-to-date branch, dependency-only file allowlist, and all six deterministic CI/security workflows green |
| Security analysis | CodeQL + Dependency Review + OpenSSF Scorecard | Independent scanners; Scorecard publishes SARIF to GitHub Code Scanning |
| Dependency inventory | Anchore Syft SBOM | SPDX JSON plus GitHub Dependency Submission snapshot |
| Coverage | cargo-llvm-cov + Codecov OIDC | Tokenless GitHub OIDC upload; informational until Codecov project/ruleset activation |
| Release integrity | SHA-256 + GitHub provenance/attestations | Release artifacts remain exact-source gated |
| Web preview | Cloudflare Workers Git integration | Per-commit/branch preview; not a merge authority |
| Documentation | MkDocs + Read the Docs config | Repository is ready to import; hosted service activation is one-time |

## One-time external activations still requiring provider authorization

These cannot be created safely from repository source alone because the provider requires the repository owner to accept terms, install a GitHub App, approve an OSS application, or issue provider credentials. The repository must remain green when they are absent.

### SignPath Foundation

Goal: replace the Windows unsigned fallback with a trusted OSS Authenticode path.

One-time provider work:

1. Apply for SignPath Foundation open-source signing.
2. Connect `Yuxin-Qiao/kumone` as the trusted source/build origin.
3. Configure the approved signing policy/project identifiers and provider credential as repository/environment secrets or variables.

Safety rule: never invent or self-sign a production certificate. Until SignPath or a real Authenticode certificate is configured, Windows releases must continue to say **unsigned** explicitly.

### BrowserStack Open Source

Goal: move standard Android and cross-browser compatibility from community-only feedback into automated device/browser runs.

One-time provider work:

1. Apply for the BrowserStack OSS plan.
2. Add the issued username/access key as repository secrets.
3. Enable Android App Automate and browser smoke suites only after credentials exist.

Safety rule: device-cloud tests are additional evidence; they do not get release/signing secrets.

### FOSSA

Goal: independent license-compliance and SCA reporting in addition to GitHub Dependency Review.

One-time provider work: authorize the public repository or add a FOSSA API key. Until then, GitHub's SBOM/dependency graph remains the source inventory of record.

### Cloudsmith

Goal: publish `.deb`/`.rpm` through a proper package repository/CDN in addition to GitHub Releases.

One-time provider work: create the OSS namespace/repository and issue a write token. Publication must consume already-validated release artifacts; Cloudsmith never builds release source with privileged secrets.

### Weblate

Goal: community-managed localization with translation PRs instead of maintainer-authored translations.

One-time provider work: create/import the hosted Libre project and map translation components. Apple/iOS remains upstream-owned; downstream localization automation should target downstream UI/resources only.

### SonarQube Cloud

Goal: independent maintainability/code-smell analysis complementary to CodeQL.

One-time provider work: import the public repository and authorize analysis. Sonar findings are advisory until a stable baseline exists, then can be promoted to a deterministic merge gate.

### Read the Docs

Goal: hosted versioned/searchable documentation and PR previews.

Repository side is already ready through `.readthedocs.yaml`, `mkdocs.yml`, and `docs/requirements.txt`. The remaining step is only importing this public repository in Read the Docs.

### CodeRabbit / StepSecurity / OpenSSF Allstar

These are GitHub Apps/services that require an owner installation/authorization step.

- CodeRabbit: independent AI PR review; no merge authority.
- StepSecurity: runner runtime/egress monitoring and workflow-hardening recommendations. Repository workflows can also use Harden-Runner directly without the App.
- OpenSSF Allstar: repository policy drift monitoring/enforcement.

### 1Password for Open Source

Optional source secret manager once provider credentials multiply. GitHub Actions should receive only the minimum short-lived/required secret for each isolated job.

### Docker Sponsored Open Source / Crowdin / OSS-Fuzz

Treat these as eligibility-based upgrades rather than prerequisites:

- Docker OSS: useful for sponsored public image distribution if project eligibility is satisfied.
- Crowdin OSS: alternative localization platform if/when its project-age/community requirements are met.
- OSS-Fuzz: valuable for protocol/parser fuzzing once the project meets acceptance criteria; local/nightly fuzzing can precede it.

## Merge authority

No external bot is allowed to become a second autonomous merge controller. The hierarchy is:

1. External services may **report, review, propose, test, translate or sign**.
2. GitHub deterministic CI/security workflows decide whether a candidate is technically acceptable.
3. The repository's fail-closed maintenance controller is the only autonomous merge path.
4. Any ambiguous ownership conflict, major dependency update, protected Apple/iOS change, missing required workflow, failed security scan, or stale base stops automation.

This avoids two automation systems competing for the same branch while still extracting the maximum useful work from free OSS infrastructure.
