import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {AdminDetailActionLabel, AdminDetailActionMenu} from './detailActionMenu';

describe('AdminDetailActionMenu', () => {
  it('renders one labelled trigger and keeps item locators on app-owned labels', () => {
    const triggerMarkup = renderToStaticMarkup(
      <AdminDetailActionMenu triggerTestId="example-detail-actions" items={[{key: 'audit', label: '操作历史'}]} />,
    );
    const itemMarkup = renderToStaticMarkup(
      <AdminDetailActionLabel testIdValue="example-detail-audit">操作历史</AdminDetailActionLabel>,
    );

    expect(triggerMarkup).toContain('操作');
    expect(triggerMarkup).toContain('aria-label="操作"');
    expect(triggerMarkup).toContain('data-testid="example-detail-actions"');
    expect(itemMarkup).toContain('data-testid="example-detail-audit"');
    expect(itemMarkup).toContain('操作历史');
  });

  it('passes a disabled state to the single trigger', () => {
    const markup = renderToStaticMarkup(
      <AdminDetailActionMenu triggerTestId="example-detail-actions" disabled items={[]} />,
    );

    expect(markup).toMatch(/data-testid="example-detail-actions"[^>]*disabled/);
  });

  it('shows the existing action busy state on the unified trigger', () => {
    const markup = renderToStaticMarkup(
      <AdminDetailActionMenu triggerTestId="example-detail-actions" loading items={[]} />,
    );

    expect(markup).toContain('data-testid="example-detail-actions"');
    expect(markup).toContain('ant-btn-loading');
  });
});
