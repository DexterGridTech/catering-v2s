import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {AdminRowActionMenu} from './rowActionMenu';

describe('AdminRowActionMenu', () => {
  it('renders a labelled row trigger with the app-owned menu locator', () => {
    const markup = renderToStaticMarkup(
      <AdminRowActionMenu triggerTestId="example-row-actions" items={[{key: 'edit', label: '编辑'}]} />,
    );

    expect(markup).toContain('操作');
    expect(markup).toContain('aria-label="操作"');
    expect(markup).toContain('data-testid="example-row-actions"');
  });

  it('keeps icon-only triggers accessible and forwards disabled/loading state', () => {
    const markup = renderToStaticMarkup(
      <AdminRowActionMenu
        triggerTestId="example-row-actions"
        ariaLabel="更多区域操作"
        icon={<span aria-hidden="true">⋮</span>}
        disabled
        loading
        items={[]}
      />,
    );

    expect(markup).toContain('aria-label="更多区域操作"');
    expect(markup).toMatch(/data-testid="example-row-actions"[^>]*disabled/);
    expect(markup).toContain('ant-btn-loading');
    expect(markup).not.toContain('>操作<');
  });
});
