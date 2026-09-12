import {
  createModuleUiVariableFactory,
  createUiCatalog,
  createUiStateModule,
  createUiVariableWrite,
  type DisplayMode,
  moduleKind,
  moduleName,
  type UiVariableDeclaration,
} from '../src/index'

const factory = createModuleUiVariableFactory(moduleName)
const text = factory.define('text', {defaultValue: '', persistIntent: 'never'})
const declaration: UiVariableDeclaration<string> = text
const write = createUiVariableWrite(declaration, 'value')
const catalog = createUiCatalog([])
const displayMode: DisplayMode = 'PRIMARY'
const uiStateModule = createUiStateModule({catalog, variables: [declaration], surfaceForm: 'laptop'})

void moduleKind
void write
void catalog
void displayMode
void uiStateModule

// @ts-expect-error A declaration's generic value type must reach the write helper.
createUiVariableWrite(declaration, 1)
