const semanticColorKeys = Object.freeze([
  'canvas', 'surface', 'surface-elevated', 'surface-inset', 'foreground', 'muted-foreground', 'border',
  'action', 'action-foreground', 'keyboard-surface', 'keyboard-key', 'keyboard-action',
  'keyboard-key-foreground', 'keyboard-action-foreground', 'keyboard-border', 'keyboard-focus', 'focus',
  'admin-shell-surface', 'admin-shell-foreground', 'admin-shell-muted', 'admin-shell-border',
  'admin-content-surface', 'admin-content-foreground', 'admin-content-muted', 'admin-content-border',
  'admin-ratio-undeclared', 'admin-inset', 'admin-action', 'admin-action-start', 'admin-action-end',
  'admin-action-foreground', 'admin-focus', 'admin-surface-current', 'admin-surface-noncurrent',
  'ok-foreground', 'ok-background', 'ok-border', 'warn-foreground', 'warn-background', 'warn-border',
  'error-foreground', 'error-background', 'error-border', 'info-foreground', 'info-background', 'info-border',
  'login-surface', 'login-foreground', 'login-muted', 'login-border', 'login-inset', 'login-focus',
  'login-action', 'login-action-start', 'login-action-end', 'login-action-foreground', 'login-icon',
]);

module.exports = Object.freeze(Object.fromEntries(
  semanticColorKeys.map(key => [key, `rgb(var(--color-${key}) / <alpha-value>)`]),
));
