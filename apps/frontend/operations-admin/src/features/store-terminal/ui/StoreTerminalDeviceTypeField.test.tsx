import {Form} from 'antd';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {StoreTerminalDeviceTypeField} from './StoreTerminalDeviceTypeField';

describe('store terminal device type field', () => {
  it('renders edit device type as owner-derived non-interactive text', () => {
    const markup = renderToStaticMarkup(
      <Form>
        <StoreTerminalDeviceTypeField mode="edit" deviceType="laptop" />
      </Form>,
    );

    expect(markup).toContain('设备类型');
    expect(markup).toContain('台式');
    expect(markup).toContain('data-testid="operations-store-terminal-device-type-readonly"');
    expect(markup).not.toMatch(/<(input|select|button)\b/i);
    expect(markup).not.toContain('role="radio"');
  });

  it('keeps device type selectable when creating a terminal', () => {
    const markup = renderToStaticMarkup(
      <Form>
        <StoreTerminalDeviceTypeField mode="create" />
      </Form>,
    );

    expect(markup).toContain('type="radio"');
    expect(markup).toContain('data-testid="operations-store-terminal-device-type-laptop"');
    expect(markup).toContain('data-testid="operations-store-terminal-device-type-mobile"');
  });
});
