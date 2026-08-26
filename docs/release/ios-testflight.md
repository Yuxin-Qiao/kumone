# Private iOS TestFlight distribution

`.github/workflows/ios-testflight.yml` builds the iOS app directly from the
upstream `missuo/kumone` commit. It does not merge upstream Swift sources into
the downstream desktop/Android tree. The only build-time patch is:

- an independently registered Bundle ID;
- the upstream semantic version from `CHANGELOG.md`;
- a monotonically increasing GitHub Actions run/attempt build number; and
- the Apple Developer team used for signing.

The workflow has a deliberate two-stage boundary: `build-unsigned` checks out
the immutable upstream commit and creates a temporary unsigned archive without
Apple credentials; `sign-upload` verifies that archive's Bundle ID and version,
then imports the certificate, signs, uploads, and assigns the build to the
internal group. The temporary archive expires after one day and the signed IPA
is never retained as a GitHub artifact.

The scheduled workflow checks upstream `main` every three hours. A commit that
was already uploaded is skipped using an Actions cache marker. `workflow_dispatch`
can build a tag or full commit SHA, and `force=true` can rebuild an existing
commit.

## One-time Apple setup

These steps require the account holder and cannot be safely automated from the
repository:

1. Register an App ID in Apple Developer with the Bundle ID
   `com.yuxinqiao.kumone` (or choose another value and set the repository
   variable `IOS_BUNDLE_IDENTIFIER`).
2. Create the matching app record in App Store Connect and create an **Internal
   Testing** group. The default group name expected by the workflow is
   `Internal Testers`; set `TESTFLIGHT_INTERNAL_GROUP` if you use another name.
3. Create an App Store Connect API key with permission to upload builds and
   manage TestFlight groups. Keep the `.p8` private key private.
4. Export an Apple Distribution certificate as a password-protected `.p12`.

Add the following repository secrets without printing their values:

| Secret | Value |
| --- | --- |
| `APP_STORE_CONNECT_KEY_ID` | API key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | App Store Connect issuer ID |
| `APP_STORE_CONNECT_PRIVATE_KEY` | Complete `.p8` contents |
| `APPLE_CERTIFICATE_BASE64` | Base64-encoded `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` password |

Add these repository variables:

| Variable | Value |
| --- | --- |
| `APPLE_DEVELOPMENT_TEAM` | 10-character Apple Developer Team ID |
| `IOS_BUNDLE_IDENTIFIER` | Optional; defaults to `com.yuxinqiao.kumone` |
| `TESTFLIGHT_INTERNAL_GROUP` | Optional; defaults to `Internal Testers` |

The workflow never reads a key from the repository checkout and never prints a
credential. If the app record, signing certificate, or API key is missing, it
stops with a specific missing-configuration error. A missing beta group does
not invalidate the uploaded build; the workflow reports a warning and the
group can be created before a forced retry.

## Device update boundary

The existing sideloaded app uses the upstream Bundle ID `sb.moe.kumone`. A
private TestFlight app with an independently owned Bundle ID is a separate iOS
installation, so TestFlight cannot replace that sideloaded copy in place. The
first TestFlight build must be installed once from the TestFlight app; later
upstream commits can then use TestFlight automatic updates.
