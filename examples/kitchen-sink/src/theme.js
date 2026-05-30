// Shared palette for the kitchen-sink demo.
//
// These live in one module — not duplicated per file — so the bridge's
// prop-diff cache hits on identical color strings across every node and
// every route. The cache compares by VALUE, so what matters is that the
// exported strings are byte-identical to the literals they replaced (the
// referential identity an `import` gives you is a bonus, not the point).
//
// ARGB hex (`#AARRGGBB`) — the wire format Skal's bridge expects.

export const BG     = '#FFF2F2F7';
export const CARD   = '#FFFFFFFF';
export const BORDER = '#FFE5E5EA';
export const INK    = '#FF1C1C1E';
export const SUBTLE = '#FF8E8E93';
export const ACCENT = '#FF0A84FF';
export const GREEN  = '#FF34C759';
export const ORANGE = '#FFFF9F0A';
export const RED    = '#FFFF3B30';
export const PURPLE = '#FF5E5CE6';
export const CHIP   = '#FFEFEFF4';
export const BODY   = '#FF334155';
