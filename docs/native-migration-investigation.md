# Native Migration Investigation

This note answers issue #64: what a safe path could look like for someone who starts
with the Docker Desktop extension and later wants to run OpenClaw natively.

## Recommendation

Keep native migration as a documented manual checklist for now. Do not build export
or native-install automation until real users ask for it and the OpenClaw portable
state model is better defined.

The Docker Desktop extension should remain the low-friction trial path. Native
OpenClaw should be treated as a later user-owned setup, not an automatic upgrade
step.

## What Can Be Reused

Reusable state is limited to user-owned OpenClaw data that the user intentionally
copies from the Docker named volume:

- project and agent files under the OpenClaw home directory
- non-secret configuration that describes selected providers or defaults
- conversation or workspace artifacts that OpenClaw stores as normal user data
- execution approval preferences after the user reviews them for the native host

The extension should not promise that every file in the Docker volume is portable.
The safe default is to copy only files OpenClaw documents as portable, or to recreate
configuration in the native setup by hand.

## What Should Not Be Copied Automatically

Do not automatically export or import:

- gateway socket tokens
- provider API keys
- auth profiles containing credentials or bearer tokens
- temporary runtime files
- container-specific paths or generated process state
- Docker-only hostnames such as `host.docker.internal`
- approval policy that grants broader native-host access than the user intended

Native execution has a larger blast radius than container execution. Any copied exec
approval policy should be reviewed before use.

## Manual Migration Checklist

Use this as an investigation checklist, not a guaranteed migration command sequence.

1. Confirm the Docker Desktop extension is working and OpenClaw is not actively
   writing important state.
2. Install or prepare native OpenClaw using upstream OpenClaw instructions.
3. Start native OpenClaw with a fresh home directory.
4. Recreate provider auth manually in native OpenClaw.
5. If using Ollama, point native OpenClaw at the host Ollama URL, usually
   `http://127.0.0.1:11434`.
6. Review the Docker volume contents and copy only user-owned files that are clearly
   portable.
7. Do not copy gateway tokens or container-generated auth material.
8. Review execution mode and approval settings before enabling broad native command
   access.
9. Start native OpenClaw and run a basic chat prompt.
10. Keep the Docker Desktop extension installed until the native setup has been
    verified and the user is comfortable deleting the Docker-managed copy.

## Extension UI Implications

No UI support is recommended yet.

If user demand appears, the first UI feature should be a read-only migration helper:

- explain what the Docker volume contains
- link to this guide
- warn that secrets are not exported
- show the current provider and execution-mode status without printing secrets
- provide copy commands only after the portable file set is confirmed upstream

Avoid a one-click "migrate to native" action. It would blur trust boundaries,
increase support burden, and risk copying secrets or container-specific state.

## Decision

For the current submission-ready project, native migration is documented as a
post-trial manual path. The Docker Desktop extension remains the supported product
surface, and native migration automation stays deferred.
