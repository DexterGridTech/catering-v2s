import {describe, expect, it} from 'vitest';
import {
  adminFrameFixtures,
  adminFrameDefinitions,
  adminFrameIds,
  adminFrameRendererBindings,
  adminFrameTestId,
  getAdminFrameFixture,
  panelFrameId,
  portsFrameId,
  runtimeFrameId,
  topologyFrameId,
} from '../src/foundations/adminFrameRegistry';

describe('admin IA frame registry', () => {
  it('freezes the 29 production frames plus one cross-tab frame', () => {
    expect(adminFrameDefinitions).toHaveLength(30);
    expect(adminFrameIds).toEqual([
      'IA-01',
      'IA-02',
      'IA-03',
      'IA-04',
      'IA-05',
      'IA-06',
      'IA-07',
      'IA-08',
      'IA-09',
      'IA-10',
      'IA-11',
      'IA-12',
      'IA-13',
      'IA-14',
      'IA-15',
      'IA-16',
      'IA-17',
      'IA-18',
      'IA-19',
      'IA-20',
      'IA-21',
      'IA-22',
      'IA-23',
      'IA-24',
      'IA-25',
      'IA-26',
      'IA-27',
      'IA-28',
      'IA-29',
      'IA-32',
    ]);
    expect(new Set(adminFrameDefinitions.map(frame => frame.id)).size).toBe(30);
    for (const frame of adminFrameDefinitions) {
      expect(frame.renderer.length).toBeGreaterThan(0);
      expect(frame.bindingKind).toBe(frame.id === 'IA-32' ? 'artifact-only' : 'production-renderer');
      expect(adminFrameFixtures[frame.fixture]).toBeDefined();
      expect(getAdminFrameFixture(frame.id)).toEqual(adminFrameFixtures[frame.fixture]);
      expect(adminFrameRendererBindings[frame.renderer]).toBeDefined();
      expect(frame.rootTestID).toBe(adminFrameTestId(frame.id));
      expect(frame.controlTestIDs.length).toBeGreaterThan(0);
      const duplicateControl = frame.controlTestIDs.find((testID, index, all) => all.indexOf(testID) !== index);
      expect(duplicateControl, `${frame.id} duplicates a control locator`).toBeUndefined();
      expect(frame.controlTestIDs).not.toContain(frame.rootTestID);
      for (const testID of frame.controlTestIDs) {
        expect(testID.length).toBeGreaterThan(0);
        expect(testID).not.toContain('*');
        expect(testID).not.toContain('...');
      }
      for (const frameVariant of frame.variants) {
        expect(frameVariant.controlTestIDs.length).toBeGreaterThan(0);
        expect(new Set(frameVariant.controlTestIDs).size).toBe(frameVariant.controlTestIDs.length);
        expect(new Set(frameVariant.mustNotTestIDs).size).toBe(frameVariant.mustNotTestIDs.length);
        expect(frameVariant.controlTestIDs).not.toEqual(expect.arrayContaining([...frameVariant.mustNotTestIDs]));
      }
    }
    expect(Object.keys(adminFrameFixtures)).toHaveLength(30);
    expect(adminFrameFixtures['ports.laptop.category-expanded'].expandedUnitKeys).toEqual([
      'logger:info',
      'logUpload:uploadLogsForDate',
    ]);
    expect(adminFrameFixtures['ports.mobile.category-expanded'].expandedUnitKeys).toEqual([
      'logger:info',
      'logUpload:uploadLogsForDate',
    ]);
    expect(Object.keys(adminFrameRendererBindings)).toEqual(
      expect.arrayContaining([
        'AdminShellFrameLaptop',
        'AdminShellFrameMobile',
        'AdminPanelStateCardLaptop',
        'AdminPanelStateCardMobile',
        'PlatformPortsSectionLaptop',
        'PlatformPortsSectionMobile',
        'RuntimeSectionLaptop',
        'RuntimeSectionMobile',
        'TopologySectionLaptop',
        'TopologySectionMobile',
        'CrossTabAudit',
      ]),
    );
    expect(adminFrameRendererBindings.CrossTabAudit.bindingKind).toBe('artifact-only');
  });

  it('selects a concrete frame for every state family instead of a broad page fallback', () => {
    expect(panelFrameId('laptop', 'normal')).toBe('IA-01');
    expect(panelFrameId('mobile', 'error')).toBe('IA-08');
    expect(portsFrameId('laptop', false)).toBe('IA-09');
    expect(portsFrameId('mobile', true)).toBe('IA-12');
    expect(
      runtimeFrameId('laptop', {
        status: 'ready',
        physicalDisplayCount: 2,
        currentSurfaceKey: 'PRIMARY',
        surfaces: [
          {
            surfaceKey: 'PRIMARY',
            displayIndex: 0,
            present: true,
            role: 'primary',
            logicalSize: null,
            physicalSize: null,
            readiness: 'ready',
          },
          {
            surfaceKey: 'SECONDARY',
            displayIndex: 1,
            present: true,
            role: 'secondary',
            logicalSize: null,
            physicalSize: null,
            readiness: 'ready',
          },
        ],
        reasonCode: null,
      }),
    ).toBe('IA-15');
    expect(
      topologyFrameId({
        surfaceForm: 'laptop',
        pageAvailable: false,
        facts: undefined,
        busy: null,
        feedbackTone: null,
      }),
    ).toBe('IA-16');
    expect(
      topologyFrameId({
        surfaceForm: 'laptop',
        pageAvailable: true,
        facts: {
          surfaceForm: 'laptop',
          displayCount: 1,
          instanceMode: 'MASTER',
          displayRole: 'CHIEF',
          paired: true,
          peerReachable: false,
          hasTopologySecondarySurface: false,
          masterLocator: null,
          peerIdentity: null,
          hostAddress: null,
          hostDesired: false,
          hostActual: 'stopped',
          hostErrorCode: null,
          payloadFailure: null,
        },
        busy: null,
        feedbackTone: null,
      }),
    ).toBe('IA-25');
  });

  it('keeps IA-14 normal and display-facts-error controls mutually exclusive', () => {
    const frame = adminFrameDefinitions.find(candidate => candidate.id === 'IA-14');
    expect(frame?.variants.map(frameVariant => frameVariant.id)).toEqual(['single-surface', 'display-facts-error']);
    expect(frame?.variants[0]?.controlTestIDs).toContain('terminal.admin:runtime:surface-map');
    expect(frame?.variants[0]?.mustNotTestIDs).toContain('terminal.admin:runtime:display-facts-error');
    expect(frame?.variants[1]?.controlTestIDs).toEqual(['terminal.admin:runtime:display-facts-error']);
    expect(frame?.variants[1]?.mustNotTestIDs).toEqual([
      'terminal.admin:runtime:surface-map',
      'terminal.admin:runtime:mobile:single-surface-boundary',
    ]);
  });

  it('drives every production fixture through its concrete frame selector', () => {
    for (const frame of adminFrameDefinitions.filter(candidate => candidate.bindingKind === 'production-renderer')) {
      const frameFixture = getAdminFrameFixture(frame.id);
      if (frameFixture.page === 'panel') {
        expect(
          panelFrameId(frameFixture.surfaceForm, frameFixture.state as 'normal' | 'empty' | 'loading' | 'error'),
        ).toBe(frame.id);
      } else if (frameFixture.page === 'ports') {
        expect(
          portsFrameId(
            frameFixture.surfaceForm,
            frameFixture.expandedCategory !== null && frameFixture.expandedCategory !== undefined,
          ),
        ).toBe(frame.id);
      } else if (frameFixture.page === 'runtime') {
        const dual = frameFixture.state === 'dual-surface';
        const surfaces = dual
          ? [
              {
                surfaceKey: 'PRIMARY' as const,
                displayIndex: 0,
                present: true,
                role: 'primary' as const,
                logicalSize: null,
                physicalSize: null,
                readiness: 'ready' as const,
              },
              {
                surfaceKey: 'SECONDARY' as const,
                displayIndex: 1,
                present: true,
                role: 'secondary' as const,
                logicalSize: null,
                physicalSize: null,
                readiness: 'ready' as const,
              },
            ]
          : [
              {
                surfaceKey: 'PRIMARY' as const,
                displayIndex: 0,
                present: true,
                role: 'primary' as const,
                logicalSize: null,
                physicalSize: null,
                readiness: 'ready' as const,
              },
            ];
        expect(
          runtimeFrameId(frameFixture.surfaceForm, {
            status: 'ready',
            physicalDisplayCount: surfaces.length,
            currentSurfaceKey: 'PRIMARY',
            surfaces,
            reasonCode: null,
          }),
        ).toBe(frame.id);
      } else if (frameFixture.page === 'topology') {
        const facts = {
          surfaceForm: frameFixture.surfaceForm,
          displayCount: 1,
          instanceMode: frameFixture.state.includes('slave') ? ('SLAVE' as const) : ('MASTER' as const),
          displayRole: frameFixture.state.includes('slave') ? ('VICE' as const) : ('CHIEF' as const),
          paired:
            frameFixture.state.includes('paired') ||
            frameFixture.state.includes('reconnecting') ||
            frameFixture.state.includes('unpairing'),
          peerReachable: frameFixture.state.includes('reachable'),
          hasTopologySecondarySurface: false,
          masterLocator: null,
          peerIdentity: null,
          hostAddress: null,
          hostDesired:
            frameFixture.state === 'host-ready' ||
            frameFixture.state === 'host-starting' ||
            frameFixture.state === 'host-error',
          hostActual:
            frameFixture.state === 'host-ready'
              ? ('running' as const)
              : frameFixture.state === 'host-starting'
                ? ('starting' as const)
                : frameFixture.state === 'host-error'
                  ? ('error' as const)
                  : ('stopped' as const),
          hostErrorCode: null,
          payloadFailure: null,
        };
        const busy =
          frameFixture.state === 'pairing'
            ? ('pair' as const)
            : frameFixture.state === 'unpairing-master' || frameFixture.state === 'unpairing-slave'
              ? ('unpair' as const)
              : null;
        const feedbackTone = frameFixture.state === 'pair-error' ? ('warn' as const) : null;
        expect(
          topologyFrameId({
            surfaceForm: frameFixture.surfaceForm,
            pageAvailable: frameFixture.state !== 'unavailable',
            facts,
            busy,
            feedbackTone,
          }),
        ).toBe(frame.id);
      }
    }
  });
});
