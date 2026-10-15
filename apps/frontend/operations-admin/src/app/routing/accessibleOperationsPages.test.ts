import {describe, expect, it} from 'vitest';
import {selectAccessibleOperationsPages} from './accessibleOperationsPages';

type PageKey = 'granted-later' | 'granted-earlier' | 'ungranted' | 'unregistered' | 'uncatalogued';

describe('selectAccessibleOperationsPages', () => {
  it('keeps authorized registrations with null icons, excludes unavailable pages, and sorts by catalog order', () => {
    const pageAccessKeys: PageKey[] = [
      'granted-later',
      'granted-earlier',
      'unregistered',
      'uncatalogued',
    ];
    const catalogByKey = new Map<PageKey, {menuOrder: number}>([
      ['granted-later', {menuOrder: 20}],
      ['granted-earlier', {menuOrder: 10}],
      ['ungranted', {menuOrder: 0}],
      ['unregistered', {menuOrder: 5}],
    ]);
    const pageRegistry: Partial<Record<PageKey, {icon: string | null}>> = {
      'granted-later': {icon: null},
      'granted-earlier': {icon: 'home'},
      ungranted: {icon: 'home'},
      uncatalogued: {icon: 'home'},
    };

    const accessiblePages = selectAccessibleOperationsPages(pageAccessKeys, catalogByKey, pageRegistry);

    expect(accessiblePages.map(({key}) => key)).toEqual(['granted-earlier', 'granted-later']);
    expect(accessiblePages[1]?.registration.icon).toBeNull();
  });
});
