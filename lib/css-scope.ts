// Direct TypeScript port of wp-cellpy's Cellpy_Css_Scope
// (wp-cellpy/plugin/cellpy-blocks/includes/class-cellpy-css-scope.php) —
// same regex/brace-depth rewrite, not a full CSS parser, matching the
// complexity the platform's own block validator already accepts.
// Approximates the isolation Shadow DOM gives the client-side JS runtime,
// without requiring JS — see ADR-wordpress-plugin-backend-rendering.md for
// why this repo renders server-side instead of using runtime.js.

export function scopeCss(css: string, wrapper: string): string {
  let depth = 0;
  let buffer = "";
  let output = "";
  let atRuleDepth: number | null = null;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];

    if (ch === "{") {
      const trimmed = buffer.trim();

      if (depth === 0) {
        if (trimmed.startsWith("@")) {
          // @media / @supports prelude — never scoped; its inner selectors
          // are scoped individually as they close, below.
          output += trimmed + " {";
          atRuleDepth = depth;
        } else {
          output += scopeSelectorList(trimmed, wrapper) + " {";
        }
      } else if (atRuleDepth !== null && depth === atRuleDepth + 1) {
        // A rule nested directly inside an @-rule's body — its selector
        // list must be scoped too.
        output += scopeSelectorList(trimmed, wrapper) + " {";
      } else {
        // Plain declaration block (depth 2+, or depth 1 with no enclosing
        // @-rule) — nothing to scope, pass through.
        output += trimmed + "{";
      }

      buffer = "";
      depth++;
      continue;
    }

    if (ch === "}") {
      depth--;
      output += buffer.trim() + "}";
      buffer = "";

      if (atRuleDepth !== null && depth === atRuleDepth) {
        atRuleDepth = null;
      }
      continue;
    }

    buffer += ch;
  }

  return output;
}

function scopeSelectorList(selectors: string, wrapper: string): string {
  if (selectors === "") return selectors;

  const parts = selectors.split(",").map((s) => s.trim());

  const scoped = parts.map((sel) => {
    if (sel === "") return sel;

    // :host targets the wrapper element itself, not a descendant of it.
    if (/^:host\b/.test(sel)) {
      return sel.replace(/^:host\b/, `.${wrapper}`);
    }

    // Idempotency: never double-prefix already-scoped content.
    if (sel.startsWith(`.${wrapper}`)) {
      return sel;
    }

    return `.${wrapper} ${sel}`;
  });

  return scoped.join(", ");
}
