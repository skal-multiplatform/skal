# DONE_OR_STALE

Docs in this folder are **historical**. They describe plans or state
that no longer match the codebase — read them at your peril; treat
them as evidence of past intent rather than current truth.

Why we keep them rather than deleting:
- Some have useful design rationale that hasn't been carried over.
- The git history would tell the story anyway, but a parked file is
  easier to find than a deleted one.
- Future revisits ("why did we choose X?") sometimes need the
  contemporaneous reasoning, not the cleaned-up later version.

If you find yourself relying on something here, **stop and verify
against the live code** (`packages/skal_flutter/lib/skal/root.dart`,
`packages/skal-js/src/bridge.js`, etc.). If the doc is still useful
after that verification, lift it back into `docs/` and update it.
