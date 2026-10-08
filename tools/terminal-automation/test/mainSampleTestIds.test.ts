import {describe, expect, it} from 'vitest';
import {mainSampleTestIds} from '../src/mainSampleTestIds.js';

describe('main sample automation IDs', () => {
  it('uses owner-defined strongly typed IDs for journey actions, inputs, and explicit update observations', () => {
    const ids = Object.values(mainSampleTestIds);
    expect(ids).toHaveLength(17);
    expect(ids.filter(id => id.startsWith('ui.feature.sample-staff-auth:'))).toHaveLength(3);
    expect(ids.filter(id => id.startsWith('ui.feature.sample-member-desk:'))).toHaveLength(11);
    expect(ids.filter(id => id.startsWith('ui.feature.sample-wallpaper-picker:'))).toHaveLength(3);
    expect(mainSampleTestIds.wallpaperAssetLoadStatus).toBeTruthy();
    expect(ids.every(id => id.includes(':automation:node:') || id.includes(':derived:'))).toBe(true);
  });
});
