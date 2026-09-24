import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(root, 'contracts/catalog/store-terminal-rules.json');
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const rules = JSON.parse(sourceText);
const schema = JSON.parse(
  fs.readFileSync(path.join(root, 'contracts/catalog/store-terminal-rules.schema.json'), 'utf8'),
);
const generatorPath = path.join(root, 'scripts/generate/store-terminal-rules.mjs');

test('store terminal rule source matches the independent function and scene matrices', () => {
  const functions = Object.fromEntries(rules.functions.map(rule => [rule.key, rule]));
  const scenesByFunction = Object.groupBy(rules.scenes, scene => scene.functionKey);

  assert.deepEqual(
    rules.deviceTypes.map(({key, label, description}) => [key, label, description]),
    [
      ['laptop', '台式', '台式可配置全部六类功能'],
      ['mobile', '手持', '手持不支持 KDS 与出餐'],
    ],
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(functions).map(([key, rule]) => [
        key,
        {
          supportedDeviceTypeKeys: rule.supportedDeviceTypeKeys,
          maxPerTerminal: rule.maxPerTerminal,
          allowedRangeKeys: rule.allowedRangeKeys,
          sceneKeys: (scenesByFunction[key] ?? []).map(scene => scene.key),
        },
      ]),
    ),
    {
      ORDERING_CASHIER: {
        supportedDeviceTypeKeys: ['laptop', 'mobile'],
        maxPerTerminal: 1,
        allowedRangeKeys: ['TABLE_AREA', 'NO_TABLE'],
        sceneKeys: [
          'TABLE_ORDER_TICKET',
          'PRECHECK_TICKET',
          'CHECKOUT_TICKET',
          'PICKUP_TICKET',
          'REVERSE_CHECKOUT_TICKET',
          'REFUND_RECEIPT',
        ],
      },
      ORDER_CONFIRMATION: {
        supportedDeviceTypeKeys: ['laptop', 'mobile'],
        maxPerTerminal: 1,
        allowedRangeKeys: ['TABLE_AREA', 'NO_TABLE', 'DELIVERY'],
        sceneKeys: [],
      },
      KDS: {
        supportedDeviceTypeKeys: ['laptop'],
        maxPerTerminal: 1,
        allowedRangeKeys: ['PRODUCTION_TAG'],
        sceneKeys: [],
      },
      KITCHEN_PRINT: {
        supportedDeviceTypeKeys: ['laptop', 'mobile'],
        maxPerTerminal: null,
        allowedRangeKeys: ['PRODUCTION_TAG'],
        sceneKeys: [
          'PREPARATION_TICKET',
          'RETURN_TICKET',
          'EXPEDITE_TICKET',
          'START_PREPARATION_TICKET',
          'LABEL_PREPARATION_TICKET',
        ],
      },
      DISPATCH: {
        supportedDeviceTypeKeys: ['laptop'],
        maxPerTerminal: 1,
        allowedRangeKeys: ['TABLE_AREA', 'NO_TABLE', 'DELIVERY'],
        sceneKeys: [
          'DISH_CHECK_SUMMARY',
          'FOOD_DELIVERY_TICKET',
          'DELIVERY_TICKET',
          'DELIVERY_MERCHANT_COPY',
          'DELIVERY_CUSTOMER_COPY',
        ],
      },
      QUEUE_CALL: {
        supportedDeviceTypeKeys: ['laptop', 'mobile'],
        maxPerTerminal: 1,
        allowedRangeKeys: ['NONE'],
        sceneKeys: ['QUEUE_NUMBER_TICKET'],
      },
    },
  );

  const thermal = ['THERMAL_58', 'THERMAL_80'];
  const label = ['LABEL_40_30', 'LABEL_40_60', 'LABEL_50_30', 'LABEL_60_40', 'LABEL_80_50'];
  assert.deepEqual(
    rules.scenes.map(({key, label: name, functionKey, allowedPaperSpecKeys}) => ({
      key,
      label: name,
      functionKey,
      allowedPaperSpecKeys,
    })),
    [
      {
        key: 'TABLE_ORDER_TICKET',
        label: '客单（压桌单）',
        functionKey: 'ORDERING_CASHIER',
        allowedPaperSpecKeys: thermal,
      },
      {key: 'PRECHECK_TICKET', label: '预结单', functionKey: 'ORDERING_CASHIER', allowedPaperSpecKeys: thermal},
      {key: 'CHECKOUT_TICKET', label: '结账单', functionKey: 'ORDERING_CASHIER', allowedPaperSpecKeys: thermal},
      {key: 'PICKUP_TICKET', label: '取餐单', functionKey: 'ORDERING_CASHIER', allowedPaperSpecKeys: thermal},
      {
        key: 'REVERSE_CHECKOUT_TICKET',
        label: '反结账单',
        functionKey: 'ORDERING_CASHIER',
        allowedPaperSpecKeys: thermal,
      },
      {key: 'REFUND_RECEIPT', label: '退款小票', functionKey: 'ORDERING_CASHIER', allowedPaperSpecKeys: thermal},
      {key: 'PREPARATION_TICKET', label: '制作单', functionKey: 'KITCHEN_PRINT', allowedPaperSpecKeys: thermal},
      {key: 'RETURN_TICKET', label: '退菜单', functionKey: 'KITCHEN_PRINT', allowedPaperSpecKeys: thermal},
      {key: 'EXPEDITE_TICKET', label: '催菜单', functionKey: 'KITCHEN_PRINT', allowedPaperSpecKeys: thermal},
      {key: 'START_PREPARATION_TICKET', label: '起菜单', functionKey: 'KITCHEN_PRINT', allowedPaperSpecKeys: thermal},
      {key: 'LABEL_PREPARATION_TICKET', label: '标签制作联', functionKey: 'KITCHEN_PRINT', allowedPaperSpecKeys: label},
      {key: 'DISH_CHECK_SUMMARY', label: '划菜总单', functionKey: 'DISPATCH', allowedPaperSpecKeys: thermal},
      {key: 'FOOD_DELIVERY_TICKET', label: '传菜单', functionKey: 'DISPATCH', allowedPaperSpecKeys: thermal},
      {key: 'DELIVERY_TICKET', label: '配送单', functionKey: 'DISPATCH', allowedPaperSpecKeys: thermal},
      {key: 'DELIVERY_MERCHANT_COPY', label: '外卖商家联', functionKey: 'DISPATCH', allowedPaperSpecKeys: thermal},
      {key: 'DELIVERY_CUSTOMER_COPY', label: '外卖顾客联', functionKey: 'DISPATCH', allowedPaperSpecKeys: thermal},
      {key: 'QUEUE_NUMBER_TICKET', label: '排队号票', functionKey: 'QUEUE_CALL', allowedPaperSpecKeys: thermal},
    ],
  );
  assert.equal(rules.scenes.length, 17);
  assert.equal(rules.paperSpecs.length, 7);
});

test('store terminal model matrix is independently frozen for V-29', () => {
  const byKey = Object.fromEntries(rules.printerModels.map(model => [model.key, model]));
  const thermal = ['THERMAL_58', 'THERMAL_80'];
  const expected = {
    EPSON_TM_T88VII: {
      brandKey: 'EPSON',
      paperSpecKeys: thermal,
      allowedConnectionMethodKeys: ['USB', 'BLUETOOTH', 'NETWORK'],
      sampleConnectionMethodKey: 'NETWORK',
    },
    ZEBRA_ZD421D: {
      brandKey: 'ZEBRA',
      paperSpecKeys: ['LABEL_40_30', 'LABEL_40_60', 'LABEL_50_30', 'LABEL_60_40', 'LABEL_80_50'],
      allowedConnectionMethodKeys: ['USB', 'BLUETOOTH', 'NETWORK'],
      sampleConnectionMethodKey: 'USB',
    },
    ZEBRA_ZD411D: {
      brandKey: 'ZEBRA',
      paperSpecKeys: ['LABEL_40_30', 'LABEL_40_60', 'LABEL_50_30', 'LABEL_60_40'],
      allowedConnectionMethodKeys: ['USB', 'BLUETOOTH', 'NETWORK'],
      sampleConnectionMethodKey: 'USB',
    },
    GENERIC_THERMAL_58: {
      brandKey: 'GENERIC',
      paperSpecKeys: ['THERMAL_58'],
      allowedConnectionMethodKeys: ['USB', 'BLUETOOTH', 'NETWORK', 'CLOUD'],
      sampleConnectionMethodKey: 'USB',
    },
    GENERIC_THERMAL_80: {
      brandKey: 'GENERIC',
      paperSpecKeys: ['THERMAL_80'],
      allowedConnectionMethodKeys: ['USB', 'BLUETOOTH', 'NETWORK', 'CLOUD'],
      sampleConnectionMethodKey: 'USB',
    },
    GENERIC_LABEL_40_30: {
      brandKey: 'GENERIC',
      paperSpecKeys: ['LABEL_40_30'],
      allowedConnectionMethodKeys: ['USB', 'BLUETOOTH', 'NETWORK', 'CLOUD'],
      sampleConnectionMethodKey: 'USB',
    },
    GENERIC_LABEL_40_60: {
      brandKey: 'GENERIC',
      paperSpecKeys: ['LABEL_40_60'],
      allowedConnectionMethodKeys: ['USB', 'BLUETOOTH', 'NETWORK', 'CLOUD'],
      sampleConnectionMethodKey: 'USB',
    },
    GENERIC_LABEL_50_30: {
      brandKey: 'GENERIC',
      paperSpecKeys: ['LABEL_50_30'],
      allowedConnectionMethodKeys: ['USB', 'BLUETOOTH', 'NETWORK', 'CLOUD'],
      sampleConnectionMethodKey: 'USB',
    },
    GENERIC_LABEL_60_40: {
      brandKey: 'GENERIC',
      paperSpecKeys: ['LABEL_60_40'],
      allowedConnectionMethodKeys: ['USB', 'BLUETOOTH', 'NETWORK', 'CLOUD'],
      sampleConnectionMethodKey: 'USB',
    },
    GENERIC_LABEL_80_50: {
      brandKey: 'GENERIC',
      paperSpecKeys: ['LABEL_80_50'],
      allowedConnectionMethodKeys: ['USB', 'BLUETOOTH', 'NETWORK', 'CLOUD'],
      sampleConnectionMethodKey: 'USB',
    },
    BUILTIN_THERMAL_58: {
      brandKey: 'GENERIC',
      paperSpecKeys: ['THERMAL_58'],
      allowedConnectionMethodKeys: ['BUILT_IN'],
      sampleConnectionMethodKey: 'BUILT_IN',
    },
    BUILTIN_THERMAL_80: {
      brandKey: 'GENERIC',
      paperSpecKeys: ['THERMAL_80'],
      allowedConnectionMethodKeys: ['BUILT_IN'],
      sampleConnectionMethodKey: 'BUILT_IN',
    },
  };
  const expectedPaperSpecs = {
    EPSON_TM_T88VII: ['THERMAL_58', 'THERMAL_80'],
    ZEBRA_ZD421D: ['LABEL_40_30', 'LABEL_40_60', 'LABEL_50_30', 'LABEL_60_40', 'LABEL_80_50'],
    ZEBRA_ZD411D: ['LABEL_40_30', 'LABEL_40_60', 'LABEL_50_30', 'LABEL_60_40'],
    GENERIC_THERMAL_58: ['THERMAL_58'],
    GENERIC_THERMAL_80: ['THERMAL_80'],
    GENERIC_LABEL_40_30: ['LABEL_40_30'],
    GENERIC_LABEL_40_60: ['LABEL_40_60'],
    GENERIC_LABEL_50_30: ['LABEL_50_30'],
    GENERIC_LABEL_60_40: ['LABEL_60_40'],
    GENERIC_LABEL_80_50: ['LABEL_80_50'],
    BUILTIN_THERMAL_58: ['THERMAL_58'],
    BUILTIN_THERMAL_80: ['THERMAL_80'],
  };
  assert.equal(Object.keys(byKey).length, 12);
  for (const [key, rule] of Object.entries(expected)) {
    assert.equal(byKey[key]?.brandKey, rule.brandKey, key);
    assert.deepEqual(byKey[key]?.paperSpecKeys, rule.paperSpecKeys, key);
    assert.deepEqual(byKey[key]?.allowedConnectionMethodKeys, rule.allowedConnectionMethodKeys, key);
    assert.deepEqual(byKey[key]?.paperSpecKeys, expectedPaperSpecs[key], `${key} paper matrix`);
    assert.ok(
      rule.allowedConnectionMethodKeys.includes(rule.sampleConnectionMethodKey),
      `${key} V-29 sample connection`,
    );
    for (const method of rules.connectionMethods.map(({key: methodKey}) => methodKey)) {
      assert.equal(
        byKey[key]?.allowedConnectionMethodKeys.includes(method),
        rule.allowedConnectionMethodKeys.includes(method),
        `${key} × ${method}`,
      );
    }
  }
  assert.equal(schema.$defs.keyArray.minItems, 1, 'required relationships must not be empty in the contract schema');
  assert.deepEqual(
    rules.connectionMethods.map(({key}) => key),
    ['NETWORK', 'CLOUD', 'USB', 'BLUETOOTH', 'BUILT_IN'],
  );
  const connectionParameters = Object.fromEntries(
    rules.connectionMethods.map(({key, parameter}) => [key, parameter]),
  );
  for (const [method, key] of [
    ['NETWORK', 'ipAddress'],
    ['CLOUD', 'deviceId'],
    ['USB', 'deviceIdentifier'],
    ['BLUETOOTH', 'deviceIdentifier'],
  ]) {
    assert.equal(connectionParameters[method]?.key, key, `${method} parameter identity`);
    assert.equal(connectionParameters[method]?.required, true, `${method} parameter required`);
  }
  assert.equal(connectionParameters.NETWORK.valueKind, 'IPV4');
  assert.match(connectionParameters.NETWORK.pattern, /\\\.\(/);
  assert.equal(connectionParameters.CLOUD.valueKind, 'IDENTIFIER');
  assert.equal(connectionParameters.USB.valueKind, 'IDENTIFIER');
  assert.equal(connectionParameters.BLUETOOTH.valueKind, 'IDENTIFIER');
  for (const method of ['CLOUD', 'USB', 'BLUETOOTH']) {
    assert.equal(connectionParameters[method].minLength, 1, `${method} identifier minimum`);
    assert.equal(connectionParameters[method].maxLength, 160, `${method} identifier maximum`);
    assert.equal(connectionParameters[method].rejectUnicodeControlCharacters, true, `${method} controls`);
  }
  assert.equal(connectionParameters.BUILT_IN, null);
  assert.deepEqual(
    rules.orderTypes.map(({key, label: name}) => [key, name]),
    [
      ['DINE_IN', '堂食'],
      ['DELIVERY', '外卖'],
      ['TAKEAWAY', '外带'],
    ],
  );
});

test('store terminal generator catches rule mutations and generated output drift', () => {
  const result = spawnSync(process.execPath, [generatorPath, '--self-test', '--check'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /STORE_TERMINAL_RULES_SELF_TEST=PASS/);
  assert.match(result.stdout, /STORE_TERMINAL_RULES_CHECK=PASS/);
  for (const mutation of [
    'NETWORK_PARAMETER_KIND_MISMATCH',
    'CLOUD_PARAMETER_KEY_MISMATCH',
    'USB_PARAMETER_KEY_MISMATCH',
    'BLUETOOTH_PARAMETER_KEY_MISMATCH',
    'BUILT_IN_PARAMETER_ADDED',
  ]) {
    assert.match(result.stdout, new RegExp(`STORE_TERMINAL_RULES_RED_${mutation}=PASS`));
  }

  const expectedHash = crypto.createHash('sha256').update(sourceText).digest('hex');
  const generatedPaths = [
    'apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/domain/generated/StoreTerminalRules.java',
    'apps/frontend/operations-admin/src/app/api/generated/storeTerminalRules.ts',
    'contracts/openapi/components/store-terminal/store-terminal-rules.generated.json',
  ];
  for (const relative of generatedPaths) {
    assert.match(fs.readFileSync(path.join(root, relative), 'utf8'), new RegExp(expectedHash));
  }
  const generatedJava = fs.readFileSync(path.join(root, generatedPaths[0]), 'utf8');
  for (const paperSpec of rules.paperSpecs.filter(({lengthMm}) => lengthMm !== null)) {
    assert.match(
      generatedJava,
      new RegExp(`new PaperSpec\\("${paperSpec.key}"[^\\n]*, ${paperSpec.widthMm}\\.0, ${paperSpec.lengthMm}\\.0\\)`),
      `${paperSpec.key} lengthMm must be emitted as a Java double literal for the boxed Double record component`,
    );
  }
  const openApi = JSON.parse(fs.readFileSync(path.join(root, generatedPaths[2]), 'utf8'));
  assert.deepEqual(
    openApi.components.schemas.StoreTerminalPrinterModelKey.enum,
    rules.printerModels.map(({key}) => key),
  );
  assert.equal(
    openApi.components.schemas.StoreTerminalRulesCatalog,
    undefined,
    'sidecar must not model key enums as full rule rows',
  );
});

test('generated store terminal Java stays within the UTF-8 byte limit', () => {
  const generatedJavaPath = path.join(
    root,
    'apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/domain/generated/StoreTerminalRules.java',
  );
  const generatedJava = fs.readFileSync(generatedJavaPath, 'utf8');
  const violations = generatedJava
    .split(/\r?\n/)
    .flatMap((line, index) => {
      const byteLength = Buffer.byteLength(line, 'utf8');
      return byteLength > 120 ? [{line: index + 1, byteLength}] : [];
    });

  assert.deepEqual(violations, []);
  assert.equal((generatedJava.match(/spotless:off/g) ?? []).length, 1);
  assert.equal((generatedJava.match(/spotless:on/g) ?? []).length, 1);
});

test('generated store terminal TypeScript compiles with its closed key unions', () => {
  const generatedTypeScriptPath = path.join(
    root,
    'apps/frontend/operations-admin/src/app/api/generated/storeTerminalRules.ts',
  );
  const program = ts.createProgram([generatedTypeScriptPath], {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  );

  assert.deepEqual(diagnostics, []);
});
