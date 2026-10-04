import {defineCommand} from '../../foundations/defineCommand';
import {moduleName} from '../../moduleName';

/** Side-effect-free registered command used to verify the remote command/result path. */
export const helloWorldCommand = defineCommand(moduleName, {
  name: 'hello-world',
  visibility: 'public',
});
