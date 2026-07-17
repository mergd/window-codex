# Security model

## Trust boundaries

Web content is untrusted. The main-world provider is a convenience interface, not an authorization boundary. Enforcement occurs in the extension service worker using the sender tab and top-frame origin. The local companion trusts only the allowlisted extension origin enforced by Chrome Native Messaging.

Cloudflare hosts static Docs and Reflex assets only. Codex history, prompts, grants, runtime traffic, and credentials never pass through a hosted window.codex service.

## Required invariants

- Grants bind to exact origins, including scheme and port.
- Navigation destroys the content-script channel.
- Cross-origin iframes do not receive a provider.
- The page cannot approve commands, filesystem changes, new permissions, or Codex input requests.
- Task creation and follow-ups display the exact origin, workspace, and message in extension UI.
- Pages cannot configure model, developer instructions, tools, approval policy, or sandbox policy.
- Metadata access does not imply transcript access.
- Analysis is a named, one-action recipe and returns derived structured data only.
- Revocation stops future access.
- Runtime identifiers, absolute paths, credentials, and raw runtime errors do not cross into pages.
- Unknown methods fail closed.

## Native transport

Chrome and the native host exchange length-prefixed JSON. Host-to-Chrome frames are capped at 1 MB and page input is never written to stdout logs. The companion uses stdio to app-server; app-server stderr is forwarded to companion stderr only.

The setup script registers `com.window.codex` for the extension ID derived from the checked-in public manifest key. The key fixes identity but is not a credential.

## Analysis isolation

The companion reads only explicitly selected threads, caps serialized history, creates an ephemeral Codex thread in a fresh temporary directory, requests read-only sandboxing with approvals disabled, and validates a fixed output schema. The disclosure explains that Codex will process the selected content and only findings return to the site.

## Known hackathon limitations

Grant and alias persistence is optimized for a single local Chrome profile. The native host and extension are developer-installed and unsigned. Production work must add a signed installer, durable alias storage, service-worker restart recovery for pending approvals, formal schema validation at every bridge, and external security review.
