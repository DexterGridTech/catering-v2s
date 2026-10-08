import {execFile as execFileCallback} from 'node:child_process';
import {promisify} from 'node:util';

const execFile = promisify(execFileCallback);
const COMMAND_TIMEOUT_MS = 10_000;
const MAX_HIERARCHY_BYTES = 2 * 1024 * 1024;
const NODE_TAG_PATTERN = /<\/?node\b[^>]*>/gu;
const ATTRIBUTE_PATTERN = /([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/gu;

export type AndroidSystemUiButton = Readonly<{
  readonly label: string;
  readonly packageName?: string;
  readonly bounds: Readonly<{readonly left: number; readonly top: number; readonly right: number; readonly bottom: number}>;
  readonly checked?: boolean;
  readonly targetClass: string;
  readonly labelClass: string;
  readonly ancestorDistance: number;
  readonly targetClickable: boolean;
  readonly targetEnabled: boolean;
  readonly stateSource: 'label' | 'target' | 'switch-descendant' | 'unknown';
}>;

type HierarchyNode = {
  readonly attributes: Map<string, string>;
  readonly parent: HierarchyNode | null;
  readonly children: HierarchyNode[];
};

const decodeXml = (value: string): string => value
  .replaceAll('&quot;', '"')
  .replaceAll('&apos;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&amp;', '&');

const safeClass = (value: string | undefined): string => value && /^[A-Za-z_$][A-Za-z0-9_.$]{0,159}$/u.test(value)
  ? value
  : 'UNKNOWN';

const systemLabelAliases: Readonly<Record<string, readonly string[]>> = Object.freeze({
  Install: Object.freeze(['安装']),
  Update: Object.freeze(['更新']),
  Settings: Object.freeze(['设置']),
  'Allow from this source': Object.freeze(['允许来自此来源的应用']),
  Cancel: Object.freeze(['取消']),
  Done: Object.freeze(['完成']),
  Open: Object.freeze(['打开']),
});

const requestedLabelFor = (actual: string, labels: readonly string[]): string | undefined =>
  labels.find(label =>
    [label, ...(systemLabelAliases[label] ?? [])].some(candidate => candidate.toLowerCase() === actual.toLowerCase()),
  );

const packageNameForNode = (node: HierarchyNode): string | undefined => {
  let current: HierarchyNode | null = node;
  while (current !== null) {
    const packageName = current.attributes.get('package');
    if (packageName !== undefined) return packageName;
    current = current.parent;
  }
  return undefined;
};

export const findAndroidSystemUiButton = (
  xml: string,
  labels: readonly string[],
  allowedPackagePrefixes?: readonly string[],
): AndroidSystemUiButton => {
  if (Buffer.byteLength(xml, 'utf8') > MAX_HIERARCHY_BYTES || !xml.includes('<hierarchy') || !xml.includes('</hierarchy>')) {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_HIERARCHY_INVALID');
  }
  if (labels.length === 0 || labels.some(label => typeof label !== 'string' || label.trim() !== label || label.length === 0)) {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_LABELS_INVALID');
  }
  const matches: AndroidSystemUiButton[] = [];
  const matchedLabels: Array<Readonly<{label: string; node: HierarchyNode}>> = [];
  const ancestors: HierarchyNode[] = [];
  for (const match of xml.matchAll(NODE_TAG_PATTERN)) {
    const tag = String(match[0]);
    if (tag.startsWith('</')) {
      ancestors.pop();
      continue;
    }
    const attributeText = tag.slice('<node'.length, tag.length - 1).replace(/\/\s*$/u, '');
    const parent = ancestors.at(-1) ?? null;
    const node: HierarchyNode = {
      attributes: new Map([...attributeText.matchAll(ATTRIBUTE_PATTERN)].map(value => [value[1]!, decodeXml(value[2]!)])),
      parent,
      children: [],
    };
    parent?.children.push(node);
    const label = node.attributes.get('text') ?? node.attributes.get('content-desc') ?? '';
    const packageName = packageNameForNode(node);
    const packageAllowed = allowedPackagePrefixes === undefined ||
      (packageName !== undefined && allowedPackagePrefixes.some(prefix => packageName === prefix || packageName.startsWith(`${prefix}.`)));
    const requestedLabel = requestedLabelFor(label, labels);
    if (requestedLabel !== undefined && packageAllowed) {
      matchedLabels.push(Object.freeze({label: requestedLabel, node}));
    }
    if (!/\/\s*>$/u.test(tag)) ancestors.push(node);
  }
  for (const {label, node} of matchedLabels) {
    let actionable: HierarchyNode | null = node;
    let ancestorDistance = 0;
    while (actionable && (actionable.attributes.get('enabled') !== 'true' || actionable.attributes.get('clickable') !== 'true')) {
      actionable = actionable.parent;
      ancestorDistance += 1;
    }
    if (!actionable) continue;
    const descendants: HierarchyNode[] = [];
    const visit = (current: HierarchyNode): void => {
      descendants.push(current);
      current.children.forEach(visit);
    };
    visit(actionable);
    const checkableSwitches = descendants.filter(candidate =>
      candidate.attributes.get('checkable') === 'true' &&
      candidate.attributes.get('enabled') === 'true' &&
      /(?:^|\.)(?:Switch|SwitchCompat)$/u.test(candidate.attributes.get('class') ?? '') &&
      (candidate.attributes.get('checked') === 'true' || candidate.attributes.get('checked') === 'false'));
    const switchTargets = checkableSwitches.filter(candidate => candidate.attributes.get('clickable') === 'true');
    const stateNode = node.attributes.get('checkable') === 'true' ? node :
      actionable.attributes.get('checkable') === 'true' ? actionable :
      checkableSwitches.length === 1 ? checkableSwitches[0] : null;
    const clickTarget = switchTargets.length === 1 ? switchTargets[0]! : actionable;
    const bounds = clickTarget.attributes.get('bounds')?.match(/^\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]$/u);
    if (!bounds) throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_BOUNDS_INVALID');
    const [, left, top, right, bottom] = bounds;
    const rectangle = {left: Number(left), top: Number(top), right: Number(right), bottom: Number(bottom)};
    if (!Object.values(rectangle).every(Number.isSafeInteger) || rectangle.right <= rectangle.left || rectangle.bottom <= rectangle.top) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_BOUNDS_INVALID');
    }
    const checked = stateNode?.attributes.get('checked');
    if (matches.some(value => value.label === label && value.bounds.left === rectangle.left &&
      value.bounds.top === rectangle.top && value.bounds.right === rectangle.right && value.bounds.bottom === rectangle.bottom)) continue;
    const packageName = packageNameForNode(node);
    matches.push(Object.freeze({label, bounds: Object.freeze(rectangle),
      ...(packageName && /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/u.test(packageName) ? {packageName} : {}),
      ...(checked === 'true' || checked === 'false' ? {checked: checked === 'true'} : {}),
      targetClass: safeClass(clickTarget.attributes.get('class')),
      labelClass: safeClass(node.attributes.get('class')),
      ancestorDistance,
      targetClickable: clickTarget.attributes.get('clickable') === 'true',
      targetEnabled: clickTarget.attributes.get('enabled') === 'true',
      stateSource: stateNode === node ? 'label' : stateNode === actionable ? 'target' :
        stateNode ? 'switch-descendant' : 'unknown'}));
  }
  if (matches.length === 0 && matchedLabels.length === 1) {
    const {label, node} = matchedLabels[0]!;
    const packageName = node.attributes.get('package');
    const labelClass = safeClass(node.attributes.get('class'));
    const hierarchyFacts: string[] = [];
    let current: HierarchyNode | null = node;
    for (let distance = 0; current !== null && distance < 5; distance += 1, current = current.parent) {
      hierarchyFacts.push([
        `ANCESTOR_${distance}`,
        `CLASS_${safeClass(current.attributes.get('class')).replaceAll('.', '_')}`,
        `ENABLED_${current.attributes.get('enabled') === 'true' ? 1 : 0}`,
        `CLICKABLE_${current.attributes.get('clickable') === 'true' ? 1 : 0}`,
        `CHECKABLE_${current.attributes.get('checkable') === 'true' ? 1 : 0}`,
        `CHECKED_${current.attributes.get('checked') === 'true' ? 1 : current.attributes.get('checked') === 'false' ? 0 : -1}`,
      ].join('_'));
    }
    throw new Error([
      'TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_BUTTON_NOT_ACTIONABLE',
      `LABEL_${label.toUpperCase().replaceAll(/[^A-Z0-9]+/gu, '_').replaceAll(/^_|_$/gu, '')}`,
      `PACKAGE_${packageName && /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/u.test(packageName)
        ? packageName.toUpperCase().replaceAll('.', '_') : 'UNKNOWN'}`,
      `CLASS_${labelClass.replaceAll('.', '_')}`,
      ...hierarchyFacts,
    ].join('_'));
  }
  if (matches.length !== 1) throw new Error(`TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_BUTTON_MATCH_COUNT_${matches.length}`);
  return matches[0]!;
};

const hasExactText = (xml: string, expectedText: string, allowedPackagePrefixes?: readonly string[]): boolean => {
  const ancestors: HierarchyNode[] = [];
  for (const match of xml.matchAll(NODE_TAG_PATTERN)) {
    const tag = String(match[0]);
    if (tag.startsWith('</')) {
      ancestors.pop();
      continue;
    }
    const attributeText = tag.slice('<node'.length, tag.length - 1).replace(/\/?\s*$/u, '');
    const attributes = new Map([...attributeText.matchAll(ATTRIBUTE_PATTERN)].map(value => [value[1]!, decodeXml(value[2]!)]));
    const node: HierarchyNode = {attributes, parent: ancestors.at(-1) ?? null, children: []};
    node.parent?.children.push(node);
    if (attributes.get('text') === expectedText || attributes.get('content-desc') === expectedText) {
      const packageName = packageNameForNode(node);
      if (allowedPackagePrefixes === undefined || (packageName !== undefined &&
        allowedPackagePrefixes.some(prefix => packageName === prefix || packageName.startsWith(`${prefix}.`)))) return true;
    }
    if (!/\/\s*>$/u.test(tag)) ancestors.push(node);
  }
  return false;
};

const hasSystemLabel = (xml: string, expectedLabel: string, allowedPackagePrefixes?: readonly string[]): boolean => {
  const ancestors: HierarchyNode[] = [];
  for (const match of xml.matchAll(NODE_TAG_PATTERN)) {
    const tag = String(match[0]);
    if (tag.startsWith('</')) {
      ancestors.pop();
      continue;
    }
    const attributeText = tag.slice('<node'.length, tag.length - 1).replace(/\/?\s*$/u, '');
    const node: HierarchyNode = {attributes: new Map([...attributeText.matchAll(ATTRIBUTE_PATTERN)].map(value => [value[1]!, decodeXml(value[2]!)])), parent: ancestors.at(-1) ?? null, children: []};
    node.parent?.children.push(node);
    const label = node.attributes.get('text') ?? node.attributes.get('content-desc') ?? '';
    const packageName = packageNameForNode(node);
    if (requestedLabelFor(label, [expectedLabel]) === expectedLabel &&
      (allowedPackagePrefixes === undefined || (packageName !== undefined &&
        allowedPackagePrefixes.some(prefix => packageName === prefix || packageName.startsWith(`${prefix}.`))))) return true;
    if (!/\/\s*>$/u.test(tag)) ancestors.push(node);
  }
  return false;
};

const summarizeSystemUi = (xml: string): string => {
  const labels = ['Install', 'Update', 'Done', 'Cancel', 'Next', 'Allow', 'Open', 'Settings', 'Allow from this source',
    'Install unknown apps', 'Disabled', 'Disabled by admin'];
  const counts = new Map(labels.map(label => [label, {text: 0, description: 0, actionable: 0}]));
  let nodes = 0;
  let actionable = 0;
  let settingsPackages = 0;
  let installerPackages = 0;
  let allowSourceNodes = 0;
  let allowSourceNodeClass = 'UNKNOWN';
  let allowSourceNodeEnabled = 0;
  let allowSourceNodeClickable = 0;
  let allowSourceNodeBounds = 0;
  let switchNodes = 0;
  let checkableSwitches = 0;
  let enabledCheckableSwitches = 0;
  let clickableCheckableSwitches = 0;
  let checkedCheckableSwitches = 0;
  let switchBounds = 0;
  const packages = new Map<string, number>();
  for (const match of xml.matchAll(NODE_TAG_PATTERN)) {
    if (String(match[0]).startsWith('</')) continue;
    nodes += 1;
    const attributeText = String(match[0]).slice('<node'.length).replace(/\/?\s*>$/u, '');
    const attributes = new Map([...attributeText.matchAll(ATTRIBUTE_PATTERN)].map(value => [value[1]!, decodeXml(value[2]!)]));
    const text = attributes.get('text') ?? '';
    const description = attributes.get('content-desc') ?? '';
    const isActionable = attributes.get('enabled') === 'true' && attributes.get('clickable') === 'true';
    const packageName = attributes.get('package') ?? '';
    const nodeClass = attributes.get('class');
    if (packageName.startsWith('com.android.settings')) settingsPackages += 1;
    if (packageName.includes('packageinstaller') || packageName.includes('PackageInstaller')) installerPackages += 1;
    if (/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/u.test(packageName)) {
      packages.set(packageName, (packages.get(packageName) ?? 0) + 1);
    }
    if (isActionable) actionable += 1;
    if (text === 'Allow from this source' || description === 'Allow from this source') {
      allowSourceNodes += 1;
      allowSourceNodeClass = safeClass(nodeClass);
      if (attributes.get('enabled') === 'true') allowSourceNodeEnabled += 1;
      if (attributes.get('clickable') === 'true') allowSourceNodeClickable += 1;
      if (attributes.has('bounds')) allowSourceNodeBounds += 1;
    }
    if (/\.(?:Switch|SwitchCompat)$/u.test(nodeClass ?? '')) {
      switchNodes += 1;
      const checkable = attributes.get('checkable') === 'true';
      if (checkable) {
        checkableSwitches += 1;
        if (attributes.get('enabled') === 'true') enabledCheckableSwitches += 1;
        if (attributes.get('clickable') === 'true') clickableCheckableSwitches += 1;
        if (attributes.get('checked') === 'true' || attributes.get('checked') === 'false') checkedCheckableSwitches += 1;
        if (attributes.has('bounds')) switchBounds += 1;
      }
    }
    for (const [label, count] of counts) {
      if (text === label) count.text += 1;
      if (description === label) count.description += 1;
      if (isActionable && (text === label || description === label)) count.actionable += 1;
    }
  }
  const labelSummary = labels.map(label => {
    const count = counts.get(label)!;
    const key = label.toUpperCase().replaceAll(/[^A-Z0-9]+/gu, '_').replaceAll(/^_|_$/gu, '');
    return `${key}_TEXT_${count.text}_DESC_${count.description}_ACTIONABLE_${count.actionable}`;
  });
  const packageSummary = [...packages].sort(([left], [right]) => left.localeCompare(right))
    .map(([packageName, count]) => `PACKAGE_${packageName.toUpperCase().replaceAll('.', '_')}_${count}`);
  return [
    `NODES_${nodes}`, `ACTIONABLE_${actionable}`, `SETTINGS_NODES_${settingsPackages}`, `INSTALLER_NODES_${installerPackages}`,
    `ALLOW_SOURCE_NODES_${allowSourceNodes}`, `ALLOW_SOURCE_CLASS_${allowSourceNodeClass.replaceAll('.', '_')}`,
    `ALLOW_SOURCE_ENABLED_${allowSourceNodeEnabled}`, `ALLOW_SOURCE_CLICKABLE_${allowSourceNodeClickable}`,
    `ALLOW_SOURCE_BOUNDS_${allowSourceNodeBounds}`, `SWITCH_NODES_${switchNodes}`, `CHECKABLE_SWITCHES_${checkableSwitches}`,
    `ENABLED_CHECKABLE_SWITCHES_${enabledCheckableSwitches}`, `CLICKABLE_CHECKABLE_SWITCHES_${clickableCheckableSwitches}`,
    `CHECKED_CHECKABLE_SWITCHES_${checkedCheckableSwitches}`, `SWITCH_BOUNDS_${switchBounds}`,
    ...labelSummary, ...packageSummary,
  ].join('_');
};

export type AndroidSystemUi = Readonly<{
  readonly readHierarchy: () => Promise<string>;
  /** A privacy-safe summary of the current native window for failure diagnostics. */
  readonly readScreenSummary: () => Promise<string>;
  /** Acknowledges Android's full-screen education overlay only when SystemUI owns it. */
  readonly acknowledgeImmersiveModeEducation: () => Promise<boolean>;
  readonly waitForButton: (
    labels: readonly string[], timeoutMs: number, signal?: AbortSignal, allowedPackagePrefixes?: readonly string[],
    expectedContext?: Readonly<{readonly label: string; readonly text: string}>,
  ) => Promise<AndroidSystemUiButton>;
  /** Resolves a fresh semantic target immediately before tapping it. */
  readonly clickButton: (input: Readonly<{
    readonly labels: readonly string[];
    readonly timeoutMs: number;
    readonly signal?: AbortSignal;
    readonly allowedPackagePrefixes?: readonly string[];
    readonly expectedContext?: Readonly<{readonly label: string; readonly text: string}>;
  }>) => Promise<AndroidSystemUiButton>;
  readonly tapButton: (button: AndroidSystemUiButton) => Promise<void>;
  readonly setChecked: (input: Readonly<{
    readonly labels: readonly string[];
    readonly checked: boolean;
    readonly timeoutMs: number;
    readonly allowedPackagePrefixes?: readonly string[];
    readonly expectedContext?: Readonly<{readonly label: string; readonly text: string}>;
  }>) => Promise<AndroidSystemUiButton>;
  readonly pressBack: () => Promise<void>;
}>;

type AndroidSystemUiCommandOutput = Readonly<{readonly stdout: string; readonly stderr: string}>;

const normalizeCommandOutput = (value: string | AndroidSystemUiCommandOutput): AndroidSystemUiCommandOutput =>
  typeof value === 'string' ? {stdout: value, stderr: ''} : value;

type ChildCommandFailure = Readonly<{
  readonly code?: string | number;
  readonly signal?: string | null;
  readonly killed?: boolean;
  readonly stdout?: string | Buffer;
  readonly stderr?: string | Buffer;
}>;

const commandFailureSummary = (error: unknown): string => {
  const failure = typeof error === 'object' && error !== null ? (error as ChildCommandFailure) : {};
  const stdout = Buffer.isBuffer(failure.stdout) ? failure.stdout.toString('utf8') : failure.stdout ?? '';
  const stderr = Buffer.isBuffer(failure.stderr) ? failure.stderr.toString('utf8') : failure.stderr ?? '';
  const code = typeof failure.code === 'number' && Number.isSafeInteger(failure.code)
    ? `EXIT_${failure.code}`
    : typeof failure.code === 'string' && /^[A-Z0-9_]{1,40}$/u.test(failure.code)
      ? `CODE_${failure.code}`
      : 'CODE_UNKNOWN';
  const signal = typeof failure.signal === 'string' && /^SIG[A-Z0-9]{1,20}$/u.test(failure.signal)
    ? failure.signal
    : 'NONE';
  const marker = (pattern: RegExp): number => pattern.test(stderr) ? 1 : 0;
  return [
    code,
    `SIGNAL_${signal}`,
    `KILLED_${failure.killed === true ? 1 : 0}`,
    `STDOUT_BYTES_${Buffer.byteLength(stdout, 'utf8')}`,
    `STDERR_BYTES_${Buffer.byteLength(stderr, 'utf8')}`,
    `STDERR_NULL_ROOT_${marker(/null root node returned/iu)}`,
    `STDERR_IDLE_TIMEOUT_${marker(/could not get idle state/iu)}`,
    `STDERR_DEVICE_OFFLINE_${marker(/device offline/iu)}`,
  ].join('_');
};

const transientHierarchyCommandOutput = (
  args: readonly string[],
  error: unknown,
): AndroidSystemUiCommandOutput | undefined => {
  const failure = typeof error === 'object' && error !== null ? (error as ChildCommandFailure) : {};
  const stderr = Buffer.isBuffer(failure.stderr) ? failure.stderr.toString('utf8') : failure.stderr ?? '';
  if (
    !args.includes('uiautomator') ||
    !args.includes('dump') ||
    failure.code !== 1 ||
    !/(?:null root node returned|could not get idle state)/iu.test(stderr)
  ) {
    return undefined;
  }
  return Object.freeze({
    stdout: Buffer.isBuffer(failure.stdout) ? failure.stdout.toString('utf8') : failure.stdout ?? '',
    stderr,
  });
};

const validateSerial = (serial: string): void => {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(serial)) {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_SERIAL_INVALID');
  }
};

const commandText = async (adbPath: string, args: readonly string[]): Promise<AndroidSystemUiCommandOutput> => {
  try {
    const {stdout, stderr} = await execFile(adbPath, [...args], {
      encoding: 'utf8',
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: MAX_HIERARCHY_BYTES + 64 * 1024,
      windowsHide: true,
    });
    return {stdout, stderr};
  } catch (error) {
    const transientOutput = transientHierarchyCommandOutput(args, error);
    if (transientOutput !== undefined) return transientOutput;
    throw new Error(`TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_COMMAND_FAILED_${commandFailureSummary(error)}`);
  }
};

export const createAndroidSystemUi = (input: Readonly<{
  readonly adbPath: string;
  readonly serial: string;
  readonly runTextCommand?: (adbPath: string, args: readonly string[]) => Promise<string | AndroidSystemUiCommandOutput>;
}>): AndroidSystemUi => {
  if (!input.adbPath) throw new Error('TERMINAL_AUTOMATION_ADB_PATH_REQUIRED');
  validateSerial(input.serial);
  const run = input.runTextCommand ?? commandText;
  const readHierarchy = async (): Promise<string> => {
    const args = ['-s', input.serial, 'exec-out', 'uiautomator', 'dump', '--compressed', '/dev/stdout'] as const;
    let rawOutput: string | AndroidSystemUiCommandOutput;
    try {
      rawOutput = await run(input.adbPath, args);
    } catch (error) {
      const transientOutput = transientHierarchyCommandOutput(args, error);
      if (transientOutput === undefined) {
        const message = error instanceof Error && /^TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_[A-Z0-9_]+$/u.test(error.message)
          ? error.message
          : `TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_COMMAND_FAILED_${commandFailureSummary(error)}`;
        throw new Error(message);
      }
      rawOutput = transientOutput;
    }
    const commandOutput = normalizeCommandOutput(rawOutput);
    const output = commandOutput.stdout;
    const start = output.indexOf('<hierarchy');
    const end = output.indexOf('</hierarchy>', start);
    if (start < 0 || end < 0) {
      const stderr = commandOutput.stderr;
      const marker = (pattern: RegExp): number => pattern.test(stderr) ? 1 : 0;
      throw new Error([
        'TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_DUMP_NOT_FOUND',
        `STDOUT_BYTES_${Buffer.byteLength(output, 'utf8')}`,
        `STDERR_BYTES_${Buffer.byteLength(stderr, 'utf8')}`,
        `STDOUT_XML_START_${start >= 0 ? 1 : 0}`,
        `STDOUT_XML_END_${end >= 0 ? 1 : 0}`,
        `STDERR_NULL_ROOT_${marker(/null root node returned/iu)}`,
        `STDERR_IDLE_TIMEOUT_${marker(/could not get idle state/iu)}`,
        `STDOUT_DUMP_ANNOUNCED_${/UI hierchary dumped to:/iu.test(output) ? 1 : 0}`,
        `STDERR_DUMP_ANNOUNCED_${marker(/UI hierchary dumped to:/iu)}`,
      ].join('_'));
    }
    return output.slice(start, end + '</hierarchy>'.length);
  };
  const readScreenSummary = async (): Promise<string> => summarizeSystemUi(await readHierarchy());
  const waitForButton = async (
    labels: readonly string[], timeoutMs: number, signal?: AbortSignal, allowedPackagePrefixes?: readonly string[],
    expectedContext?: Readonly<{readonly label: string; readonly text: string}>,
  ): Promise<AndroidSystemUiButton> => {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_TIMEOUT_INVALID');
    }
    if (signal?.aborted) throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_WAIT_CANCELLED');
    const deadline = Date.now() + timeoutMs;
    let lastReason = 'NOT_OBSERVED';
    let lastSummary = 'NO_HIERARCHY';
    let lastDumpFailure: string | undefined;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_WAIT_CANCELLED');
      let xml: string;
      try {
        xml = await readHierarchy();
        lastDumpFailure = undefined;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!/^TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_DUMP_NOT_FOUND(?:_[A-Z0-9]+)+$/u.test(message)) throw error;
        // Android's dump command can temporarily have no active accessibility root while a system
        // activity is transitioning. A button wait is already a bounded poll, so treat that sample
        // as unavailable and keep the final timeout diagnostic instead of failing on one sample.
        lastReason = 'HIERARCHY_UNAVAILABLE';
        lastSummary = 'NO_HIERARCHY';
        lastDumpFailure = message;
        await new Promise(resolve => setTimeout(resolve, Math.min(300, Math.max(1, deadline - Date.now()))));
        continue;
      }
      lastSummary = summarizeSystemUi(xml);
      try {
        const hasContextLabel = expectedContext !== undefined && labels.includes(expectedContext.label) &&
          hasSystemLabel(xml, expectedContext.label, allowedPackagePrefixes);
        if (hasContextLabel && expectedContext !== undefined &&
          !hasExactText(xml, expectedContext.text, allowedPackagePrefixes)) {
          throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_CONTEXT_TEXT_MISSING');
        }
        const button = findAndroidSystemUiButton(xml, labels, allowedPackagePrefixes);
        return button;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'HIERARCHY_NOT_MATCHED';
        if (reason === 'TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_CONTEXT_TEXT_MISSING') {
          throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_CONTEXT_TEXT_MISSING');
        }
        if (reason.startsWith('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_BUTTON_NOT_ACTIONABLE_')) {
          throw new Error(`${reason}_PAGE_${lastSummary}`);
        }
        if (!/^TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_BUTTON_MATCH_COUNT_0$/u.test(reason)) throw error;
        lastReason = 'BUTTON_NOT_PRESENT';
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(300, Math.max(1, deadline - Date.now()))));
    }
    if (signal?.aborted) throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_WAIT_CANCELLED');
    throw new Error([
      'TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_BUTTON_TIMEOUT',
      lastReason,
      lastSummary,
      ...(lastDumpFailure ? [lastDumpFailure] : []),
    ].join('_'));
  };
  const tapResolvedButton = async (
    button: AndroidSystemUiButton,
    allowedPackagePrefixes?: readonly string[],
    expectedContext?: Readonly<{readonly label: string; readonly text: string}>,
  ): Promise<void> => {
    // A hierarchy result is a short-lived observation, not a reusable coordinate.
    // Resolve the same semantic control again immediately before tapping so a
    // system transition cannot send an old coordinate into a different screen.
    const hierarchy = await readHierarchy();
    const hasContextLabel = expectedContext !== undefined && hasSystemLabel(hierarchy, expectedContext.label, allowedPackagePrefixes);
    if (hasContextLabel && expectedContext !== undefined &&
      !hasExactText(hierarchy, expectedContext.text, allowedPackagePrefixes)) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_CONTEXT_TEXT_MISSING');
    }
    const current = findAndroidSystemUiButton(hierarchy, [button.label],
      button.packageName === undefined ? undefined : [button.packageName]);
    if (current.packageName !== button.packageName || current.targetClass !== button.targetClass ||
      current.checked !== button.checked) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_BUTTON_STALE');
    }
    const {left, top, right, bottom} = current.bounds;
    const centerY = Math.floor((top + bottom) / 2);
    // Some Android Settings versions expose the source-install switch as a checked,
    // clickable row but omit the Switch child from the accessibility tree. Its
    // actionable bounds then cover the full row, while the actual toggle is at the
    // right edge. Tap the switch position instead of the row center.
    const isRowBackedSourceSwitch = current.label === 'Allow from this source' &&
      current.checked !== undefined && current.stateSource === 'target' && current.targetClass === 'android.view.View';
    const x = isRowBackedSourceSwitch
      ? right - Math.floor((bottom - top) / 2)
      : Math.floor((left + right) / 2);
    await run(input.adbPath, [
      '-s', input.serial, 'shell', 'input', 'tap',
      String(x), String(centerY),
    ]);
  };
  const tapButton = async (button: AndroidSystemUiButton): Promise<void> => tapResolvedButton(button);
  const clickButton: AndroidSystemUi['clickButton'] = async options => {
    const button = await waitForButton(
      options.labels,
      options.timeoutMs,
      options.signal,
      options.allowedPackagePrefixes,
      options.expectedContext,
    );
    await tapResolvedButton(button, options.allowedPackagePrefixes, options.expectedContext);
    return button;
  };
  const acknowledgeImmersiveModeEducation: AndroidSystemUi['acknowledgeImmersiveModeEducation'] = async () => {
    const hierarchy = await readHierarchy();
    const packagePrefixes = ['com.android.systemui'] as const;
    const title = 'Viewing full screen';
    const label = 'Got it';
    if (!hasExactText(hierarchy, title, packagePrefixes)) return false;

    const button = findAndroidSystemUiButton(hierarchy, [label], packagePrefixes);
    await tapResolvedButton(button, packagePrefixes, {label, text: title});
    return true;
  };
  const setChecked: AndroidSystemUi['setChecked'] = async input => {
    if (typeof input.checked !== 'boolean' || !Number.isSafeInteger(input.timeoutMs) ||
      input.timeoutMs < 1 || input.timeoutMs > 60_000) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_STATE_INPUT_INVALID');
    }
    const initial = await waitForButton(input.labels, input.timeoutMs, undefined,
      input.allowedPackagePrefixes, input.expectedContext);
    if (initial.checked === undefined) throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_STATE_UNKNOWN');
    if (initial.checked === input.checked) return initial;
    await tapResolvedButton(initial, input.allowedPackagePrefixes, input.expectedContext);

    const deadline = Date.now() + input.timeoutMs;
    let lastChecked: boolean | undefined;
    while (Date.now() < deadline) {
      const hierarchy = await readHierarchy();
      const current = findAndroidSystemUiButton(hierarchy, input.labels, input.allowedPackagePrefixes);
      if (input.expectedContext !== undefined &&
        !hasExactText(hierarchy, input.expectedContext.text, input.allowedPackagePrefixes)) {
        throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_CONTEXT_TEXT_MISSING');
      }
      if (current.checked === undefined) throw new Error('TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_STATE_UNKNOWN');
      lastChecked = current.checked;
      if (lastChecked === input.checked) return current;
      await new Promise(resolve => setTimeout(resolve, Math.min(150, Math.max(1, deadline - Date.now()))));
    }
    throw new Error(`TERMINAL_AUTOMATION_ANDROID_SYSTEM_UI_STATE_TIMEOUT_CHECKED_${lastChecked === undefined ? 'UNKNOWN' : Number(lastChecked)}`);
  };
  const pressBack = async (): Promise<void> => {
    await run(input.adbPath, ['-s', input.serial, 'shell', 'input', 'keyevent', 'KEYCODE_BACK']);
  };
  return Object.freeze({readHierarchy, readScreenSummary, acknowledgeImmersiveModeEducation,
    waitForButton, clickButton, tapButton, setChecked, pressBack});
};
