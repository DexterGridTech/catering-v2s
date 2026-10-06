import {createTestId} from '@catering-v2s/ui-base-primitives';
import {moduleName} from '../moduleName';

const node = (key: string) => createTestId(moduleName, 'automation', {element: 'node', key: key});

export const serverConfigPanelTestIds = Object.freeze({
  section: node('section'),
  title: node('title'),
  scroll: node('scroll'),
  readStatus: node('read.status'),
  readSpace: node('read.space'),
  space: node('space'),
  readService: node('read.service'),
  service: node('service'),
  addresses: node('addresses'),
  addressCard: (number: number) => node(`address.${number}.card`),
  addressField: (number: number, field: 'name' | 'url' | 'timeout') => node(`address.${number}.${field}`),
  readAddress: (number: number) => node(`read.address.${number}`),
  removeAddress: (number: number) => node(`address.${number}.remove`),
  addAddress: node('address.add'),
  effectiveAddress: (number: number) => node(`effective.address.${number}`),
  effectiveProxy: node('effective.proxy'),
  proxyEnabled: node('proxy.enabled'),
  proxyEnabledLabel: node('proxy.enabled.label'),
  proxyFields: node('proxy.fields'),
  proxyHost: node('proxy.host'),
  proxyPort: node('proxy.port'),
  proxyUser: node('proxy.user'),
  proxyPassword: node('proxy.password'),
  proxyPasswordConfigured: node('proxy.password-configured'),
  readProxy: node('read.proxy'),
  actions: node('actions'),
  save: node('save'),
  clear: node('clear'),
  restore: node('restore'),
  result: node('result'),
});
