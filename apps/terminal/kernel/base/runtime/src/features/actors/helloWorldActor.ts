import {defineActor, onCommand} from '../../foundations/defineActor';
import {moduleName} from '../../moduleName';
import {helloWorldCommand} from '../commands/helloWorld';

export const createHelloWorldActor = () =>
  defineActor(moduleName, 'hello-world', [onCommand(helloWorldCommand, () => Object.freeze({message: 'helloWorld'}))]);
