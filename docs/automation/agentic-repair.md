# Agentic repair boundary

Kumone treats an AI repair worker as a maintenance assistant, never as a second merge controller.

## What runs automatically

`agentic-maintenance-intake.yml` watches the trusted deterministic workflows. When a failure occurs on `main`, it:

1. reads only workflow metadata through the GitHub API;
2. classifies the failed job and computes a repeatable signature;
3. checks changed paths without checking out or executing the failed commit;
4. opens or updates one `automation/agent-repair` issue.

The workflow does not upload logs, send repository data to a model, execute candidate code, push a branch, or merge a pull request. Apple/iOS/iPadOS paths are permanently outside the automated repair scope.

## Why the repair PR is still a human/provider hand-off

GitHub Actions does not provide an account-authorized coding agent or short-lived GitHub App identity by repository source alone. Until the owner installs and authorizes one, issue-only intake is the safest useful fallback. A future provider may create a repair branch/PR only if all of these remain true:

- the branch is based on the current `main` SHA;
- the proposed diff is limited to an allowlisted non-Apple scope;
- no secret-bearing job executes untrusted candidate code;
- Core, Windows, Android, Linux, CodeQL, Dependency Review and other required deterministic checks pass for the exact head SHA;
- the normal repository merge controller remains the sole merge authority.

No AI review, suggestion, or provider status can override those gates.
