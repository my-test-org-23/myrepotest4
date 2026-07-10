---
name: deploy-production
description: >-
  Deploy the current project to the user's production VPS over SSH, running it as
  a systemd service behind Caddy (automatic HTTPS) under its configured public
  domain. Use when the user says "/deploy-production", "deploy to production",
  "ship it", "publish this app", or similar. Infrastructure facts (VPS host, base
  domain, paths) come from a global config file, NOT the project repo — the repo
  only carries a small deploy.toml.
---

# Deploy to production (VPS + systemd + Caddy)

This skill deploys **the current project** to the user's VPS. The heavy lifting
lives in `deploy.sh`; your job is to run it safely and report the result.

## How it works (mental model)

Deployment facts are split so nothing is repeated per project:

- **Global, written once** — `~/.config/agent-deploy/config.env`: `VPS_SSH`,
  `BASE_DOMAIN`, `REMOTE_ROOT`, `CADDY_SITES_DIR`. Plus a `~/.ssh/config` Host
  alias so the VPS is reachable as e.g. `ssh myvps`.
- **Per project** — a `deploy.toml` in the repo root: `name`, `port`, and
  optional overrides (`domain`, `workdir`, `start`, `env_file`, `remote_build`).

The domain defaults to `<name>.<BASE_DOMAIN>` unless `deploy.toml` sets `domain`.

## Steps

1. **Confirm this is the intended project.** Check that a `deploy.toml` exists in
   the repo root. If it's missing, offer to create one — infer `name` from the
   repo/directory name and `port` from the app's config/env (ask if unsure), then
   write a minimal `deploy.toml`. Do NOT invent a domain; let it default.

2. **Check the global config exists.** If `~/.config/agent-deploy/config.env`
   (or `$AGENT_DEPLOY_CONFIG`) is missing, STOP and walk the user through the
   one-time setup in `SETUP.md` (create the config + `~/.ssh/config` alias +
   the one-time VPS bootstrap). Do not guess VPS details.

3. **Show the plan and get explicit confirmation.** Production is
   irreversible-ish; summarize what will deploy where (the script prints this)
   and confirm before proceeding. Run the script WITHOUT `--yes` so it prompts,
   or confirm via the user directly and pass `--yes`.

4. **Run the deploy** from the repo root:

   ```bash
   bash "$CLAUDE_SKILL_DIR/deploy.sh"
   ```

   (Use the actual path to this skill's `deploy.sh`. Pass `--yes` only if the
   user already confirmed in chat.)

5. **Report the outcome.** On success, give the user the live URL
   (`https://<domain>`). On failure, surface the exact diagnostic the script
   printed (it points at `journalctl -u app-<name>` or `journalctl -u caddy`),
   and help interpret it. Common first-deploy issue: the domain's DNS A record
   doesn't point at the VPS yet, so Caddy can't issue a TLS cert — tell the user
   to set that and re-run.

## Guardrails

- Never hardcode the user's IP/domain/SSH details in the repo or in commits —
  they belong in the global config only.
- If `deploy.toml` requests a full custom `domain` or `remote_build`, respect it.
- Secrets (API access codes, etc.) go in a local `env_file` (default
  `.env.production`, gitignored) that the script ships as the systemd
  `EnvironmentFile` — never commit them.
- This deploys whatever is in the working tree. If the user expects the committed
  version, remind them to commit/pull first.
