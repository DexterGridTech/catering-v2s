// Generated from contracts/catalog/admin-catalog.json; do not edit.
export const adminCatalog = {
  "operationsPages": [
    {
      "pageDesignKey": "HOME-GROUP",
      "kind": "ROLE_HOME",
      "pageAccessManaged": false,
      "menuOrder": 10,
      "menuGroupKey": "NAV-WORKBENCH",
      "menuGroupIconKey": "WORKBENCH",
      "menuGroupLabel": "工作台",
      "menuLabel": "集团首页",
      "pageTitle": "集团首页",
      "contentTabLabel": "集团首页",
      "pageDescription": "查看当前集团的工作台内容。",
      "dataNodeCascaderLabel": null,
      "noDataNodePrompt": null,
      "noCandidatePrompt": null,
      "cascadeLevelLabels": [],
      "forbiddenAlternatives": [
        "节点首页",
        "集团工作节点"
      ],
      "requiredDataNodeType": "NONE",
      "supportedRoleNodeTypes": [
        "GROUP"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "HOME-REGION",
      "kind": "ROLE_HOME",
      "pageAccessManaged": false,
      "menuOrder": 20,
      "menuGroupKey": "NAV-WORKBENCH",
      "menuGroupIconKey": "WORKBENCH",
      "menuGroupLabel": "工作台",
      "menuLabel": "大区首页",
      "pageTitle": "大区首页",
      "contentTabLabel": "大区首页",
      "pageDescription": "查看当前大区的工作台内容。",
      "dataNodeCascaderLabel": null,
      "noDataNodePrompt": null,
      "noCandidatePrompt": null,
      "cascadeLevelLabels": [],
      "forbiddenAlternatives": [
        "节点首页",
        "大区工作节点"
      ],
      "requiredDataNodeType": "NONE",
      "supportedRoleNodeTypes": [
        "REGION"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "HOME-PROJECT",
      "kind": "ROLE_HOME",
      "pageAccessManaged": false,
      "menuOrder": 30,
      "menuGroupKey": "NAV-WORKBENCH",
      "menuGroupIconKey": "WORKBENCH",
      "menuGroupLabel": "工作台",
      "menuLabel": "项目首页",
      "pageTitle": "项目首页",
      "contentTabLabel": "项目首页",
      "pageDescription": "查看当前项目的工作台内容。",
      "dataNodeCascaderLabel": null,
      "noDataNodePrompt": null,
      "noCandidatePrompt": null,
      "cascadeLevelLabels": [],
      "forbiddenAlternatives": [
        "节点首页",
        "项目工作节点"
      ],
      "requiredDataNodeType": "NONE",
      "supportedRoleNodeTypes": [
        "PROJECT"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "HOME-HEAD-COMPANY",
      "kind": "ROLE_HOME",
      "pageAccessManaged": false,
      "menuOrder": 40,
      "menuGroupKey": "NAV-WORKBENCH",
      "menuGroupIconKey": "WORKBENCH",
      "menuGroupLabel": "工作台",
      "menuLabel": "总公司首页",
      "pageTitle": "总公司首页",
      "contentTabLabel": "总公司首页",
      "pageDescription": "查看当前总公司的工作台内容。",
      "dataNodeCascaderLabel": null,
      "noDataNodePrompt": null,
      "noCandidatePrompt": null,
      "cascadeLevelLabels": [],
      "forbiddenAlternatives": [
        "节点首页",
        "总公司工作节点"
      ],
      "requiredDataNodeType": "NONE",
      "supportedRoleNodeTypes": [
        "HEAD_COMPANY"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "HOME-STORE",
      "kind": "ROLE_HOME",
      "pageAccessManaged": false,
      "menuOrder": 50,
      "menuGroupKey": "NAV-WORKBENCH",
      "menuGroupIconKey": "WORKBENCH",
      "menuGroupLabel": "工作台",
      "menuLabel": "门店首页",
      "pageTitle": "门店首页",
      "contentTabLabel": "门店首页",
      "pageDescription": "查看当前门店的工作台内容。",
      "dataNodeCascaderLabel": null,
      "noDataNodePrompt": null,
      "noCandidatePrompt": null,
      "cascadeLevelLabels": [],
      "forbiddenAlternatives": [
        "节点首页",
        "门店工作节点"
      ],
      "requiredDataNodeType": "NONE",
      "supportedRoleNodeTypes": [
        "STORE"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "PG-ORG-STRUCTURE",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 100,
      "menuGroupKey": "NAV-ORGANIZATION",
      "menuGroupIconKey": "ORGANIZATION",
      "menuGroupLabel": "组织管理",
      "menuLabel": "组织架构",
      "pageTitle": "组织架构",
      "contentTabLabel": "组织架构",
      "pageDescription": "查看集团、大区和项目的组织架构及其详情。",
      "dataNodeCascaderLabel": null,
      "noDataNodePrompt": null,
      "noCandidatePrompt": null,
      "cascadeLevelLabels": [],
      "forbiddenAlternatives": [
        "组织节点",
        "组织树权限"
      ],
      "requiredDataNodeType": "NONE",
      "supportedRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "PG-ORG-BRAND",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 110,
      "menuGroupKey": "NAV-ORGANIZATION",
      "menuGroupIconKey": "ORGANIZATION",
      "menuGroupLabel": "组织管理",
      "menuLabel": "品牌管理",
      "pageTitle": "品牌管理",
      "contentTabLabel": "品牌管理",
      "pageDescription": "查看和维护当前集团的品牌。",
      "dataNodeCascaderLabel": null,
      "noDataNodePrompt": null,
      "noCandidatePrompt": null,
      "cascadeLevelLabels": [],
      "forbiddenAlternatives": [
        "品牌节点",
        "品牌权限"
      ],
      "requiredDataNodeType": "NONE",
      "supportedRoleNodeTypes": [
        "GROUP",
        "HEAD_COMPANY"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "PG-ORG-TENANT",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 120,
      "menuGroupKey": "NAV-ORGANIZATION",
      "menuGroupIconKey": "ORGANIZATION",
      "menuGroupLabel": "组织管理",
      "menuLabel": "经营租户管理",
      "pageTitle": "经营租户管理",
      "contentTabLabel": "经营租户管理",
      "pageDescription": "查看和维护当前集团的经营租户。",
      "dataNodeCascaderLabel": null,
      "noDataNodePrompt": null,
      "noCandidatePrompt": null,
      "cascadeLevelLabels": [],
      "forbiddenAlternatives": [
        "租户节点",
        "租户权限"
      ],
      "requiredDataNodeType": "NONE",
      "supportedRoleNodeTypes": [
        "GROUP",
        "HEAD_COMPANY"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "PG-ORG-HEAD-COMPANY",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 130,
      "menuGroupKey": "NAV-ORGANIZATION",
      "menuGroupIconKey": "ORGANIZATION",
      "menuGroupLabel": "组织管理",
      "menuLabel": "总公司管理",
      "pageTitle": "总公司管理",
      "contentTabLabel": "总公司管理",
      "pageDescription": "查看和维护当前集团的总公司。",
      "dataNodeCascaderLabel": null,
      "noDataNodePrompt": null,
      "noCandidatePrompt": null,
      "cascadeLevelLabels": [],
      "forbiddenAlternatives": [
        "总公司节点",
        "总公司权限"
      ],
      "requiredDataNodeType": "NONE",
      "supportedRoleNodeTypes": [
        "GROUP",
        "HEAD_COMPANY"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "PG-ORG-STORE-MANAGE",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 140,
      "menuGroupKey": "NAV-ORGANIZATION",
      "menuGroupIconKey": "ORGANIZATION",
      "menuGroupLabel": "组织管理",
      "menuLabel": "门店管理",
      "pageTitle": "门店管理",
      "contentTabLabel": "门店管理",
      "pageDescription": "按所选大区、项目或门店查看和维护门店。",
      "dataNodeCascaderLabel": "可视数据节点",
      "noDataNodePrompt": "请选择可视数据节点",
      "noCandidatePrompt": "当前运营角色没有可选择的数据节点",
      "cascadeLevelLabels": [
        "大区",
        "项目",
        "门店"
      ],
      "forbiddenAlternatives": [
        "门店节点",
        "门店范围"
      ],
      "requiredDataNodeType": "PROJECT",
      "supportedRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "PG-CONTRACT-STORE-MANAGE",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 150,
      "menuGroupKey": "NAV-ORGANIZATION",
      "menuGroupIconKey": "ORGANIZATION",
      "menuGroupLabel": "组织管理",
      "menuLabel": "门店合同管理",
      "pageTitle": "门店合同管理",
      "contentTabLabel": "门店合同管理",
      "pageDescription": "按所选大区、项目或门店查看和维护门店合同。",
      "dataNodeCascaderLabel": "可视数据节点",
      "noDataNodePrompt": "请选择可视数据节点",
      "noCandidatePrompt": "当前运营角色没有可选择的数据节点",
      "cascadeLevelLabels": [
        "大区",
        "项目",
        "门店"
      ],
      "forbiddenAlternatives": [
        "合同节点",
        "合同范围"
      ],
      "requiredDataNodeType": "PROJECT",
      "supportedRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "PG-IAM-GROUP-USERS",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 200,
      "menuGroupKey": "NAV-ACCESS",
      "menuGroupIconKey": "ACCESS",
      "menuGroupLabel": "用户与权限",
      "menuLabel": "集团用户管理",
      "pageTitle": "集团用户管理",
      "contentTabLabel": "集团用户管理",
      "pageDescription": "查看集团用户和集团邀请。",
      "dataNodeCascaderLabel": null,
      "noDataNodePrompt": null,
      "noCandidatePrompt": null,
      "cascadeLevelLabels": [],
      "forbiddenAlternatives": [
        "集团成员管理",
        "集团节点用户"
      ],
      "requiredDataNodeType": "NONE",
      "supportedRoleNodeTypes": [
        "GROUP"
      ],
      "userManagementTargetOrganizationType": "GROUP"
    },
    {
      "pageDesignKey": "PG-IAM-REGION-USERS",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 210,
      "menuGroupKey": "NAV-ACCESS",
      "menuGroupIconKey": "ACCESS",
      "menuGroupLabel": "用户与权限",
      "menuLabel": "大区用户管理",
      "pageTitle": "大区用户管理",
      "contentTabLabel": "大区用户管理",
      "pageDescription": "按所选大区查看大区用户和大区邀请。",
      "dataNodeCascaderLabel": "可视数据节点",
      "noDataNodePrompt": "请选择可视数据节点",
      "noCandidatePrompt": "当前运营角色没有可选择的数据节点",
      "cascadeLevelLabels": [
        "大区"
      ],
      "forbiddenAlternatives": [
        "大区成员管理",
        "大区节点用户"
      ],
      "requiredDataNodeType": "REGION",
      "supportedRoleNodeTypes": [
        "GROUP",
        "REGION"
      ],
      "userManagementTargetOrganizationType": "REGION"
    },
    {
      "pageDesignKey": "PG-IAM-PROJECT-USERS",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 220,
      "menuGroupKey": "NAV-ACCESS",
      "menuGroupIconKey": "ACCESS",
      "menuGroupLabel": "用户与权限",
      "menuLabel": "项目用户管理",
      "pageTitle": "项目用户管理",
      "contentTabLabel": "项目用户管理",
      "pageDescription": "按所选大区或项目查看项目用户和项目邀请。",
      "dataNodeCascaderLabel": "可视数据节点",
      "noDataNodePrompt": "请选择可视数据节点",
      "noCandidatePrompt": "当前运营角色没有可选择的数据节点",
      "cascadeLevelLabels": [
        "大区",
        "项目"
      ],
      "forbiddenAlternatives": [
        "项目成员管理",
        "门店用户管理",
        "项目节点用户"
      ],
      "requiredDataNodeType": "PROJECT",
      "supportedRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ],
      "userManagementTargetOrganizationType": "PROJECT"
    },
    {
      "pageDesignKey": "PG-IAM-HEAD-COMPANY-USERS",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 230,
      "menuGroupKey": "NAV-ACCESS",
      "menuGroupIconKey": "ACCESS",
      "menuGroupLabel": "用户与权限",
      "menuLabel": "总公司用户管理",
      "pageTitle": "总公司用户管理",
      "contentTabLabel": "总公司用户管理",
      "pageDescription": "查看总公司用户和总公司邀请。",
      "dataNodeCascaderLabel": "可视数据节点",
      "noDataNodePrompt": "请选择总公司",
      "noCandidatePrompt": "当前运营角色没有可选择的总公司",
      "cascadeLevelLabels": [
        "总公司"
      ],
      "forbiddenAlternatives": [
        "总公司成员管理",
        "总公司节点用户"
      ],
      "requiredDataNodeType": "HEAD_COMPANY",
      "supportedRoleNodeTypes": [
        "GROUP",
        "HEAD_COMPANY"
      ],
      "userManagementTargetOrganizationType": "HEAD_COMPANY"
    },
    {
      "pageDesignKey": "PG-IAM-STORE-USERS",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 240,
      "menuGroupKey": "NAV-ACCESS",
      "menuGroupIconKey": "ACCESS",
      "menuGroupLabel": "用户与权限",
      "menuLabel": "门店用户管理",
      "pageTitle": "门店用户管理",
      "contentTabLabel": "门店用户管理",
      "pageDescription": "按所选大区、项目或门店查看门店用户和门店邀请。",
      "dataNodeCascaderLabel": "可视数据节点",
      "noDataNodePrompt": "请选择可视数据节点",
      "noCandidatePrompt": "当前运营角色没有可选择的数据节点",
      "cascadeLevelLabels": [
        "大区",
        "项目",
        "门店"
      ],
      "forbiddenAlternatives": [
        "门店成员管理",
        "门店节点用户"
      ],
      "requiredDataNodeType": "STORE",
      "supportedRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT",
        "STORE"
      ],
      "userManagementTargetOrganizationType": "STORE"
    },
    {
      "pageDesignKey": "PG-STORE-PROFILE",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 300,
      "menuGroupKey": "NAV-STORE-OPERATIONS",
      "menuGroupIconKey": "STORE_OPERATIONS",
      "menuGroupLabel": "门店经营",
      "menuLabel": "门店资料",
      "pageTitle": "门店资料",
      "contentTabLabel": "门店资料",
      "pageDescription": "查看门店基本资料和合同信息。",
      "dataNodeCascaderLabel": "可视数据节点",
      "noDataNodePrompt": "请选择可视数据节点",
      "noCandidatePrompt": "当前运营角色没有可选择的数据节点",
      "cascadeLevelLabels": [
        "大区",
        "项目",
        "门店"
      ],
      "forbiddenAlternatives": [
        "门店档案节点",
        "门店配置"
      ],
      "requiredDataNodeType": "STORE",
      "supportedRoleNodeTypes": [
        "STORE"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "PG-CATALOG-STORE-ITEMS",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 510,
      "menuGroupKey": "NAV-CATALOG-SERVICES",
      "menuGroupIconKey": "CATALOG_SERVICES",
      "menuGroupLabel": "商品与服务",
      "menuLabel": "门店商品管理",
      "pageTitle": "门店商品管理",
      "contentTabLabel": "门店商品管理",
      "pageDescription": "按所选门店维护商品字典、商品资料与库存配置。",
      "dataNodeCascaderLabel": "可视数据节点",
      "noDataNodePrompt": "请选择可视数据节点",
      "noCandidatePrompt": "当前运营角色没有可选择的数据节点",
      "cascadeLevelLabels": [
        "大区",
        "项目",
        "门店"
      ],
      "forbiddenAlternatives": [
        "门店商品库",
        "门店商品节点"
      ],
      "requiredDataNodeType": "STORE",
      "supportedRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT",
        "STORE"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "PG-INVENTORY-STORE-STATUS",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 520,
      "menuGroupKey": "NAV-CATALOG-SERVICES",
      "menuGroupIconKey": "CATALOG_SERVICES",
      "menuGroupLabel": "商品与服务",
      "menuLabel": "门店库存管理",
      "pageTitle": "门店库存管理",
      "contentTabLabel": "门店库存管理",
      "pageDescription": "查看门店库存现状、变化与库存对象诊断。",
      "dataNodeCascaderLabel": "可视数据节点",
      "noDataNodePrompt": "请选择可视数据节点",
      "noCandidatePrompt": "当前运营角色没有可选择的数据节点",
      "cascadeLevelLabels": [
        "大区",
        "项目",
        "门店"
      ],
      "forbiddenAlternatives": [
        "商品库存管理",
        "库存台账页面"
      ],
      "requiredDataNodeType": "STORE",
      "supportedRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT",
        "STORE"
      ],
      "userManagementTargetOrganizationType": null
    },
    {
      "pageDesignKey": "PG-CATALOG-BRAND-ITEMS",
      "kind": "BUSINESS",
      "pageAccessManaged": true,
      "menuOrder": 530,
      "menuGroupKey": "NAV-CATALOG-SERVICES",
      "menuGroupIconKey": "CATALOG_SERVICES",
      "menuGroupLabel": "商品与服务",
      "menuLabel": "品牌商品管理",
      "pageTitle": "品牌商品管理",
      "contentTabLabel": "品牌商品管理",
      "pageDescription": "按总公司与品牌维护品牌商品字典并复制到门店。",
      "dataNodeCascaderLabel": "可视总公司节点",
      "noDataNodePrompt": "请选择可视总公司节点",
      "noCandidatePrompt": "当前角色没有可选择的总公司节点",
      "cascadeLevelLabels": [
        "总公司"
      ],
      "forbiddenAlternatives": [
        "总公司商品管理",
        "品牌节点商品"
      ],
      "requiredDataNodeType": "HEAD_COMPANY",
      "supportedRoleNodeTypes": [
        "GROUP",
        "HEAD_COMPANY"
      ],
      "userManagementTargetOrganizationType": null
    }
  ],
  "actionGroups": [
    {
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100
    },
    {
      "actionGroupKey": "STORE_MANAGEMENT",
      "actionGroupLabel": "门店管理",
      "actionGroupOrder": 200
    },
    {
      "actionGroupKey": "USER_MANAGEMENT",
      "actionGroupLabel": "用户管理",
      "actionGroupOrder": 300
    },
    {
      "actionGroupKey": "STORE_CONTRACT_MANAGEMENT",
      "actionGroupLabel": "门店合同管理",
      "actionGroupOrder": 400
    },
    {
      "actionGroupKey": "CATALOG_MANAGEMENT",
      "actionGroupLabel": "商品与服务",
      "actionGroupOrder": 500
    }
  ],
  "actions": [
    {
      "actionKey": "BC-ORG-GROUP-EDIT",
      "actionLabel": "编辑集团资料",
      "actionDescription": "编辑集团资料",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-STRUCTURE",
          "selectedIdentityTypes": [
            "GROUP"
          ],
          "scopeApplicability": "GROUP_VISIBLE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP"
      ]
    },
    {
      "actionKey": "BC-ORG-GROUP-STATUS",
      "actionLabel": "启停集团",
      "actionDescription": "启停集团",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-STRUCTURE",
          "selectedIdentityTypes": [
            "GROUP"
          ],
          "scopeApplicability": "GROUP_VISIBLE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP"
      ]
    },
    {
      "actionKey": "BC-ORG-REGION-CREATE",
      "actionLabel": "新建大区",
      "actionDescription": "新建大区",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-STRUCTURE",
          "selectedIdentityTypes": [
            "GROUP"
          ],
          "scopeApplicability": "GROUP_VISIBLE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP"
      ]
    },
    {
      "actionKey": "BC-ORG-REGION-EDIT",
      "actionLabel": "编辑大区",
      "actionDescription": "编辑大区",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-STRUCTURE",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION"
          ],
          "scopeApplicability": "VISIBLE_REGION"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION"
      ]
    },
    {
      "actionKey": "BC-ORG-REGION-STATUS",
      "actionLabel": "启停大区",
      "actionDescription": "启停大区",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-STRUCTURE",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION"
          ],
          "scopeApplicability": "VISIBLE_REGION"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION"
      ]
    },
    {
      "actionKey": "BC-ORG-PROJECT-CREATE",
      "actionLabel": "新建项目",
      "actionDescription": "新建项目",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-STRUCTURE",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION"
          ],
          "scopeApplicability": "VISIBLE_REGION"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION"
      ]
    },
    {
      "actionKey": "BC-ORG-PROJECT-EDIT",
      "actionLabel": "编辑项目",
      "actionDescription": "编辑项目",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-STRUCTURE",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT"
          ],
          "scopeApplicability": "VISIBLE_PROJECT"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ]
    },
    {
      "actionKey": "BC-ORG-PROJECT-STATUS",
      "actionLabel": "启停项目",
      "actionDescription": "启停项目",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-STRUCTURE",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT"
          ],
          "scopeApplicability": "VISIBLE_PROJECT"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ]
    },
    {
      "actionKey": "BC-ORG-BRAND-CREATE",
      "actionLabel": "新建品牌",
      "actionDescription": "新建品牌",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-BRAND",
          "selectedIdentityTypes": [
            "GROUP"
          ],
          "scopeApplicability": "NONE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP"
      ]
    },
    {
      "actionKey": "BC-ORG-BRAND-EDIT",
      "actionLabel": "编辑品牌",
      "actionDescription": "编辑品牌",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-BRAND",
          "selectedIdentityTypes": [
            "GROUP"
          ],
          "scopeApplicability": "NONE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP"
      ]
    },
    {
      "actionKey": "BC-ORG-BRAND-STATUS",
      "actionLabel": "启停品牌",
      "actionDescription": "启停品牌",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-BRAND",
          "selectedIdentityTypes": [
            "GROUP"
          ],
          "scopeApplicability": "NONE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP"
      ]
    },
    {
      "actionKey": "BC-ORG-TENANT-CREATE",
      "actionLabel": "新建经营租户",
      "actionDescription": "新建经营租户",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-TENANT",
          "selectedIdentityTypes": [
            "GROUP"
          ],
          "scopeApplicability": "NONE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP"
      ]
    },
    {
      "actionKey": "BC-ORG-TENANT-EDIT",
      "actionLabel": "编辑经营租户",
      "actionDescription": "编辑经营租户",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-TENANT",
          "selectedIdentityTypes": [
            "GROUP"
          ],
          "scopeApplicability": "NONE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP"
      ]
    },
    {
      "actionKey": "BC-ORG-TENANT-STATUS",
      "actionLabel": "启停经营租户",
      "actionDescription": "启停经营租户",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-TENANT",
          "selectedIdentityTypes": [
            "GROUP"
          ],
          "scopeApplicability": "NONE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP"
      ]
    },
    {
      "actionKey": "BC-ORG-HEAD-COMPANY-CREATE",
      "actionLabel": "新建总公司",
      "actionDescription": "新建总公司",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-HEAD-COMPANY",
          "selectedIdentityTypes": [
            "GROUP",
            "HEAD_COMPANY"
          ],
          "scopeApplicability": "NONE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "HEAD_COMPANY"
      ]
    },
    {
      "actionKey": "BC-ORG-HEAD-COMPANY-EDIT",
      "actionLabel": "编辑总公司",
      "actionDescription": "编辑总公司",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-HEAD-COMPANY",
          "selectedIdentityTypes": [
            "GROUP",
            "HEAD_COMPANY"
          ],
          "scopeApplicability": "NONE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "HEAD_COMPANY"
      ]
    },
    {
      "actionKey": "BC-ORG-HEAD-COMPANY-STATUS",
      "actionLabel": "启停总公司",
      "actionDescription": "启停总公司",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-HEAD-COMPANY",
          "selectedIdentityTypes": [
            "GROUP",
            "HEAD_COMPANY"
          ],
          "scopeApplicability": "NONE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "HEAD_COMPANY"
      ]
    },
    {
      "actionKey": "BC-ORG-HEAD-COMPANY-BRAND",
      "actionLabel": "维护总公司品牌授权",
      "actionDescription": "维护总公司品牌授权",
      "actionGroupKey": "ORGANIZATION_MANAGEMENT",
      "actionGroupLabel": "组织管理",
      "actionGroupOrder": 100,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-HEAD-COMPANY",
          "selectedIdentityTypes": [
            "GROUP",
            "HEAD_COMPANY"
          ],
          "scopeApplicability": "NONE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "HEAD_COMPANY"
      ]
    },
    {
      "actionKey": "BC-ORG-STORE-CREATE",
      "actionLabel": "新建门店",
      "actionDescription": "新建门店",
      "actionGroupKey": "STORE_MANAGEMENT",
      "actionGroupLabel": "门店管理",
      "actionGroupOrder": 200,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-STORE-MANAGE",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT"
          ],
          "scopeApplicability": "SELECTED_PROJECT_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ]
    },
    {
      "actionKey": "BC-ORG-STORE-EDIT",
      "actionLabel": "编辑门店",
      "actionDescription": "编辑门店",
      "actionGroupKey": "STORE_MANAGEMENT",
      "actionGroupLabel": "门店管理",
      "actionGroupOrder": 200,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-STORE-MANAGE",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT"
          ],
          "scopeApplicability": "SELECTED_PROJECT_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ]
    },
    {
      "actionKey": "BC-ORG-STORE-STATUS",
      "actionLabel": "启停门店",
      "actionDescription": "启停门店",
      "actionGroupKey": "STORE_MANAGEMENT",
      "actionGroupLabel": "门店管理",
      "actionGroupOrder": 200,
      "pageBindings": [
        {
          "pageDesignKey": "PG-ORG-STORE-MANAGE",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT"
          ],
          "scopeApplicability": "SELECTED_PROJECT_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ]
    },
    {
      "actionKey": "BC-IAM-GROUP-ROLE-REVOKE",
      "actionLabel": "撤销集团用户运营角色",
      "actionDescription": "撤销集团用户运营角色",
      "actionGroupKey": "USER_MANAGEMENT",
      "actionGroupLabel": "用户管理",
      "actionGroupOrder": 300,
      "pageBindings": [
        {
          "pageDesignKey": "PG-IAM-GROUP-USERS",
          "selectedIdentityTypes": [
            "GROUP"
          ],
          "scopeApplicability": "NONE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP"
      ],
      "userManagement": {
        "targetOrganizationType": "GROUP",
        "purpose": "ROLE_REVOKE"
      }
    },
    {
      "actionKey": "BC-IAM-REGION-ROLE-REVOKE",
      "actionLabel": "撤销大区用户运营角色",
      "actionDescription": "撤销大区用户运营角色",
      "actionGroupKey": "USER_MANAGEMENT",
      "actionGroupLabel": "用户管理",
      "actionGroupOrder": 300,
      "pageBindings": [
        {
          "pageDesignKey": "PG-IAM-REGION-USERS",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION"
          ],
          "scopeApplicability": "SELECTED_REGION_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION"
      ],
      "userManagement": {
        "targetOrganizationType": "REGION",
        "purpose": "ROLE_REVOKE"
      }
    },
    {
      "actionKey": "BC-IAM-PROJECT-ROLE-REVOKE",
      "actionLabel": "撤销项目用户运营角色",
      "actionDescription": "撤销项目用户运营角色",
      "actionGroupKey": "USER_MANAGEMENT",
      "actionGroupLabel": "用户管理",
      "actionGroupOrder": 300,
      "pageBindings": [
        {
          "pageDesignKey": "PG-IAM-PROJECT-USERS",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT"
          ],
          "scopeApplicability": "SELECTED_PROJECT_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ],
      "userManagement": {
        "targetOrganizationType": "PROJECT",
        "purpose": "ROLE_REVOKE"
      }
    },
    {
      "actionKey": "BC-IAM-HEAD-COMPANY-ROLE-REVOKE",
      "actionLabel": "撤销总公司用户运营角色",
      "actionDescription": "撤销总公司用户运营角色",
      "actionGroupKey": "USER_MANAGEMENT",
      "actionGroupLabel": "用户管理",
      "actionGroupOrder": 300,
      "pageBindings": [
        {
          "pageDesignKey": "PG-IAM-HEAD-COMPANY-USERS",
          "selectedIdentityTypes": [
            "GROUP",
            "HEAD_COMPANY"
          ],
          "scopeApplicability": "HEAD_COMPANY_TARGET"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "HEAD_COMPANY"
      ],
      "userManagement": {
        "targetOrganizationType": "HEAD_COMPANY",
        "purpose": "ROLE_REVOKE"
      }
    },
    {
      "actionKey": "BC-IAM-STORE-ROLE-REVOKE",
      "actionLabel": "撤销门店用户运营角色",
      "actionDescription": "撤销门店用户运营角色",
      "actionGroupKey": "USER_MANAGEMENT",
      "actionGroupLabel": "用户管理",
      "actionGroupOrder": 300,
      "pageBindings": [
        {
          "pageDesignKey": "PG-IAM-STORE-USERS",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT",
            "STORE"
          ],
          "scopeApplicability": "SELECTED_STORE_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT",
        "STORE"
      ],
      "userManagement": {
        "targetOrganizationType": "STORE",
        "purpose": "ROLE_REVOKE"
      }
    },
    {
      "actionKey": "BC-IAM-GROUP-INVITE",
      "actionLabel": "管理集团用户邀请",
      "actionDescription": "管理集团用户邀请",
      "actionGroupKey": "USER_MANAGEMENT",
      "actionGroupLabel": "用户管理",
      "actionGroupOrder": 300,
      "pageBindings": [
        {
          "pageDesignKey": "PG-IAM-GROUP-USERS",
          "selectedIdentityTypes": [
            "GROUP"
          ],
          "scopeApplicability": "NONE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP"
      ],
      "userManagement": {
        "targetOrganizationType": "GROUP",
        "purpose": "INVITE"
      }
    },
    {
      "actionKey": "BC-IAM-REGION-INVITE",
      "actionLabel": "管理大区用户邀请",
      "actionDescription": "管理大区用户邀请",
      "actionGroupKey": "USER_MANAGEMENT",
      "actionGroupLabel": "用户管理",
      "actionGroupOrder": 300,
      "pageBindings": [
        {
          "pageDesignKey": "PG-IAM-REGION-USERS",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION"
          ],
          "scopeApplicability": "SELECTED_REGION_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION"
      ],
      "userManagement": {
        "targetOrganizationType": "REGION",
        "purpose": "INVITE"
      }
    },
    {
      "actionKey": "BC-IAM-PROJECT-INVITE",
      "actionLabel": "管理项目用户邀请",
      "actionDescription": "管理项目用户邀请",
      "actionGroupKey": "USER_MANAGEMENT",
      "actionGroupLabel": "用户管理",
      "actionGroupOrder": 300,
      "pageBindings": [
        {
          "pageDesignKey": "PG-IAM-PROJECT-USERS",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT"
          ],
          "scopeApplicability": "SELECTED_PROJECT_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ],
      "userManagement": {
        "targetOrganizationType": "PROJECT",
        "purpose": "INVITE"
      }
    },
    {
      "actionKey": "BC-IAM-HEAD-COMPANY-INVITE",
      "actionLabel": "管理总公司用户邀请",
      "actionDescription": "管理总公司用户邀请",
      "actionGroupKey": "USER_MANAGEMENT",
      "actionGroupLabel": "用户管理",
      "actionGroupOrder": 300,
      "pageBindings": [
        {
          "pageDesignKey": "PG-IAM-HEAD-COMPANY-USERS",
          "selectedIdentityTypes": [
            "GROUP",
            "HEAD_COMPANY"
          ],
          "scopeApplicability": "HEAD_COMPANY_TARGET"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "HEAD_COMPANY"
      ],
      "userManagement": {
        "targetOrganizationType": "HEAD_COMPANY",
        "purpose": "INVITE"
      }
    },
    {
      "actionKey": "BC-IAM-STORE-INVITE",
      "actionLabel": "管理门店用户邀请",
      "actionDescription": "管理门店用户邀请",
      "actionGroupKey": "USER_MANAGEMENT",
      "actionGroupLabel": "用户管理",
      "actionGroupOrder": 300,
      "pageBindings": [
        {
          "pageDesignKey": "PG-IAM-STORE-USERS",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT",
            "STORE"
          ],
          "scopeApplicability": "SELECTED_STORE_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT",
        "STORE"
      ],
      "userManagement": {
        "targetOrganizationType": "STORE",
        "purpose": "INVITE"
      }
    },
    {
      "actionKey": "BC-CONTRACT-CREATE",
      "actionLabel": "新建门店合同",
      "actionDescription": "新建门店合同",
      "actionGroupKey": "STORE_CONTRACT_MANAGEMENT",
      "actionGroupLabel": "门店合同管理",
      "actionGroupOrder": 400,
      "pageBindings": [
        {
          "pageDesignKey": "PG-CONTRACT-STORE-MANAGE",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT"
          ],
          "scopeApplicability": "SELECTED_PROJECT_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ]
    },
    {
      "actionKey": "BC-CONTRACT-EDIT",
      "actionLabel": "编辑门店合同",
      "actionDescription": "编辑门店合同",
      "actionGroupKey": "STORE_CONTRACT_MANAGEMENT",
      "actionGroupLabel": "门店合同管理",
      "actionGroupOrder": 400,
      "pageBindings": [
        {
          "pageDesignKey": "PG-CONTRACT-STORE-MANAGE",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT"
          ],
          "scopeApplicability": "SELECTED_PROJECT_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ]
    },
    {
      "actionKey": "BC-CONTRACT-INVALIDATE",
      "actionLabel": "设置门店合同失效",
      "actionDescription": "设置门店合同失效",
      "actionGroupKey": "STORE_CONTRACT_MANAGEMENT",
      "actionGroupLabel": "门店合同管理",
      "actionGroupOrder": 400,
      "pageBindings": [
        {
          "pageDesignKey": "PG-CONTRACT-STORE-MANAGE",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT"
          ],
          "scopeApplicability": "SELECTED_PROJECT_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT"
      ]
    },
    {
      "actionKey": "EDIT_CATALOG_LIBRARY",
      "actionLabel": "编辑商品库",
      "actionDescription": "编辑商品库",
      "actionGroupKey": "CATALOG_MANAGEMENT",
      "actionGroupLabel": "商品与服务",
      "actionGroupOrder": 500,
      "pageBindings": [
        {
          "pageDesignKey": "PG-CATALOG-STORE-ITEMS",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT",
            "HEAD_COMPANY",
            "STORE"
          ],
          "scopeApplicability": "SELECTED_CATALOG_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT",
        "HEAD_COMPANY",
        "STORE"
      ]
    },
    {
      "actionKey": "READ_INVENTORY_ADVANCED_DIAGNOSTICS",
      "actionLabel": "查看库存高级诊断",
      "actionDescription": "查看库存高级诊断",
      "actionGroupKey": "CATALOG_MANAGEMENT",
      "actionGroupLabel": "商品与服务",
      "actionGroupOrder": 500,
      "pageBindings": [
        {
          "pageDesignKey": "PG-INVENTORY-STORE-STATUS",
          "selectedIdentityTypes": [
            "GROUP",
            "REGION",
            "PROJECT",
            "STORE"
          ],
          "scopeApplicability": "SELECTED_STORE_SCOPE"
        }
      ],
      "grantableRoleNodeTypes": [
        "GROUP",
        "REGION",
        "PROJECT",
        "STORE"
      ]
    }
  ],
  "userManagementActionBindings": [
    {
      "pageDesignKey": "PG-IAM-GROUP-USERS",
      "targetOrganizationType": "GROUP",
      "actionPurpose": "ROLE_REVOKE",
      "actionKey": "BC-IAM-GROUP-ROLE-REVOKE"
    },
    {
      "pageDesignKey": "PG-IAM-REGION-USERS",
      "targetOrganizationType": "REGION",
      "actionPurpose": "ROLE_REVOKE",
      "actionKey": "BC-IAM-REGION-ROLE-REVOKE"
    },
    {
      "pageDesignKey": "PG-IAM-PROJECT-USERS",
      "targetOrganizationType": "PROJECT",
      "actionPurpose": "ROLE_REVOKE",
      "actionKey": "BC-IAM-PROJECT-ROLE-REVOKE"
    },
    {
      "pageDesignKey": "PG-IAM-HEAD-COMPANY-USERS",
      "targetOrganizationType": "HEAD_COMPANY",
      "actionPurpose": "ROLE_REVOKE",
      "actionKey": "BC-IAM-HEAD-COMPANY-ROLE-REVOKE"
    },
    {
      "pageDesignKey": "PG-IAM-STORE-USERS",
      "targetOrganizationType": "STORE",
      "actionPurpose": "ROLE_REVOKE",
      "actionKey": "BC-IAM-STORE-ROLE-REVOKE"
    },
    {
      "pageDesignKey": "PG-IAM-GROUP-USERS",
      "targetOrganizationType": "GROUP",
      "actionPurpose": "INVITE",
      "actionKey": "BC-IAM-GROUP-INVITE"
    },
    {
      "pageDesignKey": "PG-IAM-REGION-USERS",
      "targetOrganizationType": "REGION",
      "actionPurpose": "INVITE",
      "actionKey": "BC-IAM-REGION-INVITE"
    },
    {
      "pageDesignKey": "PG-IAM-PROJECT-USERS",
      "targetOrganizationType": "PROJECT",
      "actionPurpose": "INVITE",
      "actionKey": "BC-IAM-PROJECT-INVITE"
    },
    {
      "pageDesignKey": "PG-IAM-HEAD-COMPANY-USERS",
      "targetOrganizationType": "HEAD_COMPANY",
      "actionPurpose": "INVITE",
      "actionKey": "BC-IAM-HEAD-COMPANY-INVITE"
    },
    {
      "pageDesignKey": "PG-IAM-STORE-USERS",
      "targetOrganizationType": "STORE",
      "actionPurpose": "INVITE",
      "actionKey": "BC-IAM-STORE-INVITE"
    }
  ],
  "userManagementByPage": {
    "PG-IAM-GROUP-USERS": {
      "targetOrganizationType": "GROUP",
      "inviteActionKey": "BC-IAM-GROUP-INVITE",
      "roleRevokeActionKey": "BC-IAM-GROUP-ROLE-REVOKE"
    },
    "PG-IAM-REGION-USERS": {
      "targetOrganizationType": "REGION",
      "inviteActionKey": "BC-IAM-REGION-INVITE",
      "roleRevokeActionKey": "BC-IAM-REGION-ROLE-REVOKE"
    },
    "PG-IAM-PROJECT-USERS": {
      "targetOrganizationType": "PROJECT",
      "inviteActionKey": "BC-IAM-PROJECT-INVITE",
      "roleRevokeActionKey": "BC-IAM-PROJECT-ROLE-REVOKE"
    },
    "PG-IAM-HEAD-COMPANY-USERS": {
      "targetOrganizationType": "HEAD_COMPANY",
      "inviteActionKey": "BC-IAM-HEAD-COMPANY-INVITE",
      "roleRevokeActionKey": "BC-IAM-HEAD-COMPANY-ROLE-REVOKE"
    },
    "PG-IAM-STORE-USERS": {
      "targetOrganizationType": "STORE",
      "inviteActionKey": "BC-IAM-STORE-INVITE",
      "roleRevokeActionKey": "BC-IAM-STORE-ROLE-REVOKE"
    }
  }
} as const;
export const operationsPageDesignKeys = {
  "HomeGroup": "HOME-GROUP",
  "HomeRegion": "HOME-REGION",
  "HomeProject": "HOME-PROJECT",
  "HomeHeadCompany": "HOME-HEAD-COMPANY",
  "HomeStore": "HOME-STORE",
  "PgOrgStructure": "PG-ORG-STRUCTURE",
  "PgOrgBrand": "PG-ORG-BRAND",
  "PgOrgTenant": "PG-ORG-TENANT",
  "PgOrgHeadCompany": "PG-ORG-HEAD-COMPANY",
  "PgOrgStoreManage": "PG-ORG-STORE-MANAGE",
  "PgContractStoreManage": "PG-CONTRACT-STORE-MANAGE",
  "PgIamGroupUsers": "PG-IAM-GROUP-USERS",
  "PgIamRegionUsers": "PG-IAM-REGION-USERS",
  "PgIamProjectUsers": "PG-IAM-PROJECT-USERS",
  "PgIamHeadCompanyUsers": "PG-IAM-HEAD-COMPANY-USERS",
  "PgIamStoreUsers": "PG-IAM-STORE-USERS",
  "PgStoreProfile": "PG-STORE-PROFILE",
  "PgCatalogStoreItems": "PG-CATALOG-STORE-ITEMS",
  "PgInventoryStoreStatus": "PG-INVENTORY-STORE-STATUS",
  "PgCatalogBrandItems": "PG-CATALOG-BRAND-ITEMS"
} as const;
export type AdminCatalog = typeof adminCatalog;
export type OperationsPageDesignKey = typeof operationsPageDesignKeys[keyof typeof operationsPageDesignKeys];
export const ACTION_CAPABILITIES = {
  "ORG_GROUP_EDIT": "BC-ORG-GROUP-EDIT",
  "ORG_GROUP_STATUS": "BC-ORG-GROUP-STATUS",
  "ORG_REGION_CREATE": "BC-ORG-REGION-CREATE",
  "ORG_REGION_EDIT": "BC-ORG-REGION-EDIT",
  "ORG_REGION_STATUS": "BC-ORG-REGION-STATUS",
  "ORG_PROJECT_CREATE": "BC-ORG-PROJECT-CREATE",
  "ORG_PROJECT_EDIT": "BC-ORG-PROJECT-EDIT",
  "ORG_PROJECT_STATUS": "BC-ORG-PROJECT-STATUS",
  "ORG_BRAND_CREATE": "BC-ORG-BRAND-CREATE",
  "ORG_BRAND_EDIT": "BC-ORG-BRAND-EDIT",
  "ORG_BRAND_STATUS": "BC-ORG-BRAND-STATUS",
  "ORG_TENANT_CREATE": "BC-ORG-TENANT-CREATE",
  "ORG_TENANT_EDIT": "BC-ORG-TENANT-EDIT",
  "ORG_TENANT_STATUS": "BC-ORG-TENANT-STATUS",
  "ORG_HEAD_COMPANY_CREATE": "BC-ORG-HEAD-COMPANY-CREATE",
  "ORG_HEAD_COMPANY_EDIT": "BC-ORG-HEAD-COMPANY-EDIT",
  "ORG_HEAD_COMPANY_STATUS": "BC-ORG-HEAD-COMPANY-STATUS",
  "ORG_HEAD_COMPANY_BRAND": "BC-ORG-HEAD-COMPANY-BRAND",
  "ORG_STORE_CREATE": "BC-ORG-STORE-CREATE",
  "ORG_STORE_EDIT": "BC-ORG-STORE-EDIT",
  "ORG_STORE_STATUS": "BC-ORG-STORE-STATUS",
  "IAM_GROUP_ROLE_REVOKE": "BC-IAM-GROUP-ROLE-REVOKE",
  "IAM_REGION_ROLE_REVOKE": "BC-IAM-REGION-ROLE-REVOKE",
  "IAM_PROJECT_ROLE_REVOKE": "BC-IAM-PROJECT-ROLE-REVOKE",
  "IAM_HEAD_COMPANY_ROLE_REVOKE": "BC-IAM-HEAD-COMPANY-ROLE-REVOKE",
  "IAM_STORE_ROLE_REVOKE": "BC-IAM-STORE-ROLE-REVOKE",
  "IAM_GROUP_INVITE": "BC-IAM-GROUP-INVITE",
  "IAM_REGION_INVITE": "BC-IAM-REGION-INVITE",
  "IAM_PROJECT_INVITE": "BC-IAM-PROJECT-INVITE",
  "IAM_HEAD_COMPANY_INVITE": "BC-IAM-HEAD-COMPANY-INVITE",
  "IAM_STORE_INVITE": "BC-IAM-STORE-INVITE",
  "CONTRACT_CREATE": "BC-CONTRACT-CREATE",
  "CONTRACT_EDIT": "BC-CONTRACT-EDIT",
  "CONTRACT_INVALIDATE": "BC-CONTRACT-INVALIDATE",
  "EDIT_CATALOG_LIBRARY": "EDIT_CATALOG_LIBRARY",
  "READ_INVENTORY_ADVANCED_DIAGNOSTICS": "READ_INVENTORY_ADVANCED_DIAGNOSTICS"
} as const;
export type AdminActionCapabilityKey = typeof ACTION_CAPABILITIES[keyof typeof ACTION_CAPABILITIES];
export const USER_MANAGEMENT_PAGE_DESIGN_KEYS = [
  "PG-IAM-GROUP-USERS",
  "PG-IAM-REGION-USERS",
  "PG-IAM-PROJECT-USERS",
  "PG-IAM-HEAD-COMPANY-USERS",
  "PG-IAM-STORE-USERS"
] as const;
export type UserManagementPageDesignKey = typeof USER_MANAGEMENT_PAGE_DESIGN_KEYS[number];
export function userManagementFor(pageDesignKey: UserManagementPageDesignKey) {
  const value = adminCatalog.userManagementByPage[pageDesignKey];
  if (!value) throw new Error(`USER_MANAGEMENT_TARGET_MISSING:${pageDesignKey}`);
  return value;
}
