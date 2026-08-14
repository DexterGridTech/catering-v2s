import type {CSSProperties} from 'react';

export const operationsLoginFormPageLayout = {
  style: {display: 'block', minHeight: '100vh'},
  containerStyle: {
    width: '100%',
    maxWidth: '100%',
    margin: 0,
    padding: 32,
    border: '1px solid var(--operations-admin-color-border)',
    borderRadius: 12,
    background: 'var(--operations-admin-color-bg-container)',
    boxShadow: 'var(--operations-admin-box-shadow-secondary)',
  },
  mainStyle: {width: '100%', margin: '0 auto'},
} satisfies {style: CSSProperties; containerStyle: CSSProperties; mainStyle: CSSProperties};
