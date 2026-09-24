// GENERATED FILE. DO NOT EDIT. sourceSha256=a2fa58ab2df72f0ce21352295f4f58a6ab06905a636cd6b5b0eedf57b8bdd292
export const STORE_TERMINAL_RULES_SOURCE_SHA256 = "a2fa58ab2df72f0ce21352295f4f58a6ab06905a636cd6b5b0eedf57b8bdd292" as const;

export const STORE_TERMINAL_DEVICE_TYPES = [
  {
    "key": "laptop",
    "label": "台式",
    "description": "台式可配置全部六类功能"
  },
  {
    "key": "mobile",
    "label": "手持",
    "description": "手持不支持 KDS 与出餐"
  }
] as const;

export const STORE_TERMINAL_FUNCTIONS = [
  {
    "key": "ORDERING_CASHIER",
    "label": "点餐收银",
    "supportedDeviceTypeKeys": [
      "laptop",
      "mobile"
    ],
    "maxPerTerminal": 1,
    "allowedRangeKeys": [
      "TABLE_AREA",
      "NO_TABLE"
    ]
  },
  {
    "key": "ORDER_CONFIRMATION",
    "label": "接单确认",
    "supportedDeviceTypeKeys": [
      "laptop",
      "mobile"
    ],
    "maxPerTerminal": 1,
    "allowedRangeKeys": [
      "TABLE_AREA",
      "NO_TABLE",
      "DELIVERY"
    ]
  },
  {
    "key": "KDS",
    "label": "KDS",
    "supportedDeviceTypeKeys": [
      "laptop"
    ],
    "maxPerTerminal": 1,
    "allowedRangeKeys": [
      "PRODUCTION_TAG"
    ]
  },
  {
    "key": "KITCHEN_PRINT",
    "label": "厨打",
    "supportedDeviceTypeKeys": [
      "laptop",
      "mobile"
    ],
    "maxPerTerminal": null,
    "allowedRangeKeys": [
      "PRODUCTION_TAG"
    ]
  },
  {
    "key": "DISPATCH",
    "label": "出餐",
    "supportedDeviceTypeKeys": [
      "laptop"
    ],
    "maxPerTerminal": 1,
    "allowedRangeKeys": [
      "TABLE_AREA",
      "NO_TABLE",
      "DELIVERY"
    ]
  },
  {
    "key": "QUEUE_CALL",
    "label": "排队叫号",
    "supportedDeviceTypeKeys": [
      "laptop",
      "mobile"
    ],
    "maxPerTerminal": 1,
    "allowedRangeKeys": [
      "NONE"
    ]
  }
] as const;

export const STORE_TERMINAL_RANGES = [
  {
    "key": "TABLE_AREA",
    "label": "桌台区"
  },
  {
    "key": "NO_TABLE",
    "label": "无桌台"
  },
  {
    "key": "DELIVERY",
    "label": "外卖"
  },
  {
    "key": "PRODUCTION_TAG",
    "label": "生产标签"
  },
  {
    "key": "NONE",
    "label": "无范围"
  }
] as const;

export const STORE_TERMINAL_SCENES = [
  {
    "key": "TABLE_ORDER_TICKET",
    "label": "客单（压桌单）",
    "functionKey": "ORDERING_CASHIER",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "PRECHECK_TICKET",
    "label": "预结单",
    "functionKey": "ORDERING_CASHIER",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "CHECKOUT_TICKET",
    "label": "结账单",
    "functionKey": "ORDERING_CASHIER",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "PICKUP_TICKET",
    "label": "取餐单",
    "functionKey": "ORDERING_CASHIER",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "REVERSE_CHECKOUT_TICKET",
    "label": "反结账单",
    "functionKey": "ORDERING_CASHIER",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "REFUND_RECEIPT",
    "label": "退款小票",
    "functionKey": "ORDERING_CASHIER",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "PREPARATION_TICKET",
    "label": "制作单",
    "functionKey": "KITCHEN_PRINT",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "RETURN_TICKET",
    "label": "退菜单",
    "functionKey": "KITCHEN_PRINT",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "EXPEDITE_TICKET",
    "label": "催菜单",
    "functionKey": "KITCHEN_PRINT",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "START_PREPARATION_TICKET",
    "label": "起菜单",
    "functionKey": "KITCHEN_PRINT",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "LABEL_PREPARATION_TICKET",
    "label": "标签制作联",
    "functionKey": "KITCHEN_PRINT",
    "allowedPaperSpecKeys": [
      "LABEL_40_30",
      "LABEL_40_60",
      "LABEL_50_30",
      "LABEL_60_40",
      "LABEL_80_50"
    ]
  },
  {
    "key": "DISH_CHECK_SUMMARY",
    "label": "划菜总单",
    "functionKey": "DISPATCH",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "FOOD_DELIVERY_TICKET",
    "label": "传菜单",
    "functionKey": "DISPATCH",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "DELIVERY_TICKET",
    "label": "配送单",
    "functionKey": "DISPATCH",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "DELIVERY_MERCHANT_COPY",
    "label": "外卖商家联",
    "functionKey": "DISPATCH",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "DELIVERY_CUSTOMER_COPY",
    "label": "外卖顾客联",
    "functionKey": "DISPATCH",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  },
  {
    "key": "QUEUE_NUMBER_TICKET",
    "label": "排队号票",
    "functionKey": "QUEUE_CALL",
    "allowedPaperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ]
  }
] as const;

export const STORE_TERMINAL_PAPER_SPECS = [
  {
    "key": "THERMAL_58",
    "label": "热敏 58 毫米",
    "kind": "THERMAL_ROLL",
    "widthMm": 58,
    "lengthMm": null
  },
  {
    "key": "THERMAL_80",
    "label": "热敏 80 毫米",
    "kind": "THERMAL_ROLL",
    "widthMm": 80,
    "lengthMm": null
  },
  {
    "key": "LABEL_40_30",
    "label": "标签 40×30 毫米",
    "kind": "LABEL",
    "widthMm": 40,
    "lengthMm": 30
  },
  {
    "key": "LABEL_40_60",
    "label": "标签 40×60 毫米",
    "kind": "LABEL",
    "widthMm": 40,
    "lengthMm": 60
  },
  {
    "key": "LABEL_50_30",
    "label": "标签 50×30 毫米",
    "kind": "LABEL",
    "widthMm": 50,
    "lengthMm": 30
  },
  {
    "key": "LABEL_60_40",
    "label": "标签 60×40 毫米",
    "kind": "LABEL",
    "widthMm": 60,
    "lengthMm": 40
  },
  {
    "key": "LABEL_80_50",
    "label": "标签 80×50 毫米",
    "kind": "LABEL",
    "widthMm": 80,
    "lengthMm": 50
  }
] as const;

export const STORE_TERMINAL_CONNECTION_METHODS = [
  {
    "key": "NETWORK",
    "label": "网口",
    "parameter": {
      "key": "ipAddress",
      "label": "IP 地址",
      "valueKind": "IPV4",
      "required": true,
      "pattern": "^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(\\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$"
    }
  },
  {
    "key": "CLOUD",
    "label": "云端",
    "parameter": {
      "key": "deviceId",
      "label": "设备 ID",
      "valueKind": "IDENTIFIER",
      "required": true,
      "minLength": 1,
      "maxLength": 160,
      "rejectUnicodeControlCharacters": true
    }
  },
  {
    "key": "USB",
    "label": "USB",
    "parameter": {
      "key": "deviceIdentifier",
      "label": "USB 设备标识",
      "valueKind": "IDENTIFIER",
      "required": true,
      "minLength": 1,
      "maxLength": 160,
      "rejectUnicodeControlCharacters": true
    }
  },
  {
    "key": "BLUETOOTH",
    "label": "蓝牙",
    "parameter": {
      "key": "deviceIdentifier",
      "label": "蓝牙设备标识",
      "valueKind": "IDENTIFIER",
      "required": true,
      "minLength": 1,
      "maxLength": 160,
      "rejectUnicodeControlCharacters": true
    }
  },
  {
    "key": "BUILT_IN",
    "label": "设备内置",
    "parameter": null
  }
] as const;

export const STORE_TERMINAL_ORDER_TYPES = [
  {
    "key": "DINE_IN",
    "label": "堂食"
  },
  {
    "key": "DELIVERY",
    "label": "外卖"
  },
  {
    "key": "TAKEAWAY",
    "label": "外带"
  }
] as const;

export const STORE_TERMINAL_PRINTER_BRANDS = [
  {
    "key": "EPSON",
    "label": "爱普生"
  },
  {
    "key": "ZEBRA",
    "label": "斑马"
  },
  {
    "key": "GENERIC",
    "label": "通用设备"
  }
] as const;

export const STORE_TERMINAL_PRINTER_MODELS = [
  {
    "key": "EPSON_TM_T88VII",
    "brandKey": "EPSON",
    "label": "TM-T88VII",
    "paperSpecKeys": [
      "THERMAL_58",
      "THERMAL_80"
    ],
    "allowedConnectionMethodKeys": [
      "USB",
      "BLUETOOTH",
      "NETWORK"
    ],
    "evidenceUri": "https://files.support.epson.com/pdf/pos/bulk/tm-t88vii_trg_en_revg.pdf"
  },
  {
    "key": "ZEBRA_ZD421D",
    "brandKey": "ZEBRA",
    "label": "ZD421 Direct Thermal",
    "paperSpecKeys": [
      "LABEL_40_30",
      "LABEL_40_60",
      "LABEL_50_30",
      "LABEL_60_40",
      "LABEL_80_50"
    ],
    "allowedConnectionMethodKeys": [
      "USB",
      "BLUETOOTH",
      "NETWORK"
    ],
    "evidenceUri": "https://www.zebra.com/us/en/products/spec-sheets/printers/desktop/zd400-series.html"
  },
  {
    "key": "ZEBRA_ZD411D",
    "brandKey": "ZEBRA",
    "label": "ZD411 Direct Thermal",
    "paperSpecKeys": [
      "LABEL_40_30",
      "LABEL_40_60",
      "LABEL_50_30",
      "LABEL_60_40"
    ],
    "allowedConnectionMethodKeys": [
      "USB",
      "BLUETOOTH",
      "NETWORK"
    ],
    "evidenceUri": "https://www.zebra.com/us/en/products/spec-sheets/printers/desktop/zd400-series.html"
  },
  {
    "key": "GENERIC_THERMAL_58",
    "brandKey": "GENERIC",
    "label": "通用热敏 58 毫米",
    "paperSpecKeys": [
      "THERMAL_58"
    ],
    "allowedConnectionMethodKeys": [
      "USB",
      "BLUETOOTH",
      "NETWORK",
      "CLOUD"
    ],
    "evidenceUri": null
  },
  {
    "key": "GENERIC_THERMAL_80",
    "brandKey": "GENERIC",
    "label": "通用热敏 80 毫米",
    "paperSpecKeys": [
      "THERMAL_80"
    ],
    "allowedConnectionMethodKeys": [
      "USB",
      "BLUETOOTH",
      "NETWORK",
      "CLOUD"
    ],
    "evidenceUri": null
  },
  {
    "key": "GENERIC_LABEL_40_30",
    "brandKey": "GENERIC",
    "label": "通用标签 40×30 毫米",
    "paperSpecKeys": [
      "LABEL_40_30"
    ],
    "allowedConnectionMethodKeys": [
      "USB",
      "BLUETOOTH",
      "NETWORK",
      "CLOUD"
    ],
    "evidenceUri": null
  },
  {
    "key": "GENERIC_LABEL_40_60",
    "brandKey": "GENERIC",
    "label": "通用标签 40×60 毫米",
    "paperSpecKeys": [
      "LABEL_40_60"
    ],
    "allowedConnectionMethodKeys": [
      "USB",
      "BLUETOOTH",
      "NETWORK",
      "CLOUD"
    ],
    "evidenceUri": null
  },
  {
    "key": "GENERIC_LABEL_50_30",
    "brandKey": "GENERIC",
    "label": "通用标签 50×30 毫米",
    "paperSpecKeys": [
      "LABEL_50_30"
    ],
    "allowedConnectionMethodKeys": [
      "USB",
      "BLUETOOTH",
      "NETWORK",
      "CLOUD"
    ],
    "evidenceUri": null
  },
  {
    "key": "GENERIC_LABEL_60_40",
    "brandKey": "GENERIC",
    "label": "通用标签 60×40 毫米",
    "paperSpecKeys": [
      "LABEL_60_40"
    ],
    "allowedConnectionMethodKeys": [
      "USB",
      "BLUETOOTH",
      "NETWORK",
      "CLOUD"
    ],
    "evidenceUri": null
  },
  {
    "key": "GENERIC_LABEL_80_50",
    "brandKey": "GENERIC",
    "label": "通用标签 80×50 毫米",
    "paperSpecKeys": [
      "LABEL_80_50"
    ],
    "allowedConnectionMethodKeys": [
      "USB",
      "BLUETOOTH",
      "NETWORK",
      "CLOUD"
    ],
    "evidenceUri": null
  },
  {
    "key": "BUILTIN_THERMAL_58",
    "brandKey": "GENERIC",
    "label": "设备内置热敏 58 毫米",
    "paperSpecKeys": [
      "THERMAL_58"
    ],
    "allowedConnectionMethodKeys": [
      "BUILT_IN"
    ],
    "evidenceUri": null
  },
  {
    "key": "BUILTIN_THERMAL_80",
    "brandKey": "GENERIC",
    "label": "设备内置热敏 80 毫米",
    "paperSpecKeys": [
      "THERMAL_80"
    ],
    "allowedConnectionMethodKeys": [
      "BUILT_IN"
    ],
    "evidenceUri": null
  }
] as const;

export type StoreTerminalDeviceTypeKey = typeof STORE_TERMINAL_DEVICE_TYPES[number]['key'];
export type StoreTerminalFunctionKey = typeof STORE_TERMINAL_FUNCTIONS[number]['key'];
export type StoreTerminalRangeKey = typeof STORE_TERMINAL_RANGES[number]['key'];
export type StoreTerminalSceneKey = typeof STORE_TERMINAL_SCENES[number]['key'];
export type StoreTerminalPaperSpecKey = typeof STORE_TERMINAL_PAPER_SPECS[number]['key'];
export type StoreTerminalConnectionMethodKey = typeof STORE_TERMINAL_CONNECTION_METHODS[number]['key'];
export type StoreTerminalOrderTypeKey = typeof STORE_TERMINAL_ORDER_TYPES[number]['key'];
export type StoreTerminalPrinterBrandKey = typeof STORE_TERMINAL_PRINTER_BRANDS[number]['key'];
export type StoreTerminalPrinterModelKey = typeof STORE_TERMINAL_PRINTER_MODELS[number]['key'];

export function storeTerminalScenesForFunction(functionKey: StoreTerminalFunctionKey) {
  return STORE_TERMINAL_SCENES.filter(scene => scene.functionKey === functionKey);
}

export function storeTerminalModelSupportsPaper(modelKey: StoreTerminalPrinterModelKey, paperSpecKey: StoreTerminalPaperSpecKey) {
  const model = STORE_TERMINAL_PRINTER_MODELS.find(model => model.key === modelKey);
  return model
    ? (model.paperSpecKeys as readonly StoreTerminalPaperSpecKey[]).includes(paperSpecKey)
    : false;
}

export function storeTerminalModelSupportsConnection(modelKey: StoreTerminalPrinterModelKey, methodKey: StoreTerminalConnectionMethodKey) {
  const model = STORE_TERMINAL_PRINTER_MODELS.find(model => model.key === modelKey);
  return model
    ? (model.allowedConnectionMethodKeys as readonly StoreTerminalConnectionMethodKey[]).includes(methodKey)
    : false;
}
