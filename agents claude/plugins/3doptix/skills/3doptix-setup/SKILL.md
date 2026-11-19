---
name: 3doptix-setup
description: "Use when the 3DOptix MCP server is not connected, returns an authentication error, or the user is installing the 3DOptix plugin for the first time. Guides sign-in and verifies the connection."
---

# Connecting 3DOptix

The plugin bundles one remote MCP server, `3doptix`, at `https://mcp.3doptix.com`. It requires a
3DOptix account. Authentication is OAuth 2.0 with dynamic client registration, so there is no API
key to paste and nothing to add to a config file.

## Connect

The server is declared by the plugin, so it appears automatically after install. To sign in:

- **Claude Code** — run `/mcp`, select **3doptix**, and complete the browser sign-in.
- **Codex** — run `codex mcp login 3doptix`.

A browser window opens on the 3DOptix sign-in page. Approve access and return to the terminal.
Tokens are stored by the client and refreshed automatically; you should not need to repeat this.

## Verify

Confirm the connection before starting real work:

1. Run `3doptix_api_healthcheck`. It should succeed without an auth error.
2. Run `3doptix_client_status` to confirm which account is connected.
3. Run `3doptix_setup_list` to list the setups on that account.

If step 3 returns an empty list on an account that should have setups, the wrong account is
connected — sign out and repeat the connect step.

## If sign-in fails

| Symptom | Cause and fix |
|---|---|
| `Needs authentication` persists after sign-in | The client did not store the token. Re-run the connect step and watch for a browser error. |
| Browser never opens | Copy the URL the client prints and open it manually. |
| Sign-in succeeds, tools still fail | The account may have no active subscription, or an expired trial. Check at https://simulation.3doptix.com |
| Codex reports a client-registration error | Codex supports dynamic client registration only. If your organisation's identity provider requires a pre-registered client, contact support@3doptix.com |

## Do not do this

Do not ask the user for an API key, and do not call `3doptix_client_set_api_key` unless the user
explicitly asks for key-based auth on a client with no OAuth support. OAuth is the supported path;
keys are a legacy fallback and should not be pasted into a shared or committed config file.

## Getting an account

Sign up at https://www.3doptix.com. New accounts get a fully functional trial, enough to create
setups and run simulations. Support: support@3doptix.com
