# One-time setup for the `deploy-production` skill

Do this once. Afterwards, `/deploy-production` works in any project that has a
`deploy.toml`.

## 1. Install the skill globally (so it's available in every project)

This repo ships the skill under `.claude/skills/deploy-production/`. Copy it into
your personal skills directory so Claude Code loads it everywhere:

```bash
mkdir -p ~/.claude/skills
cp -r .claude/skills/deploy-production ~/.claude/skills/
```

(Or keep it in a dotfiles repo and symlink:
`ln -s ~/dotfiles/deploy-production ~/.claude/skills/deploy-production`.)

## 2. Create the global infra config (written once)

```bash
mkdir -p ~/.config/agent-deploy
cp ~/.claude/skills/deploy-production/config.env.example ~/.config/agent-deploy/config.env
# then edit VPS_SSH, BASE_DOMAIN, REMOTE_ROOT, CADDY_SITES_DIR
```

## 3. Add an SSH alias (so the VPS is just `ssh myvps`)

In `~/.ssh/config`:

```
Host myvps
    HostName 203.0.113.10        # your VPS public IP
    User deploy                  # a sudo-capable user
    IdentityFile ~/.ssh/id_ed25519
```

Set `VPS_SSH=myvps` in the config from step 2. Test with `ssh myvps`.

## 4. Bootstrap the VPS (once)

The deploy user needs passwordless (or cached) `sudo`, and the box needs Node,
rsync, and Caddy:

```bash
# on the VPS
sudo apt update
sudo apt install -y rsync curl debian-keyring debian-archive-keyring apt-transport-https
# Node 22 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs build-essential   # build-essential for native modules
# Caddy (official repo)
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Make the main Caddyfile import per-app site files. Edit `/etc/caddy/Caddyfile`:

```
{
    email you@example.com     # for Let's Encrypt
}
import /etc/caddy/sites/*.caddy
```

```bash
sudo mkdir -p /etc/caddy/sites
sudo systemctl reload caddy
```

## 5. Point DNS at the VPS

For each app's domain (e.g. `scheduler.apps.example.com` or a wildcard
`*.apps.example.com`), add a DNS **A record** pointing at the VPS IP. Caddy
issues the TLS cert automatically on first request — but DNS must resolve first.

---

That's it. Now, in any project:

```
/deploy-production
```

The project just needs a `deploy.toml` (see the repo README).
