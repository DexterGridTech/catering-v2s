import {describe, expect, it, vi} from 'vitest'
import {
  createWorkspaceActionDispatcher,
  createWorkspaceStateKeys,
  toWorkspaceStateDescriptors,
} from '../src/index'
import {exampleReducer} from './testSupport'

describe('workspace support', () => {
  it('creates only MAIN and BRANCH workspace state keys', () => {
    expect(createWorkspaceStateKeys('orders')).toEqual({
      MAIN: 'orders.MAIN',
      BRANCH: 'orders.BRANCH',
    })
  })

  it('rewrites action type at the final slash and preserves action fields', () => {
    const dispatch = vi.fn()
    const route = createWorkspaceActionDispatcher({
      routeContext: {workspace: 'BRANCH'},
      dispatch,
    })

    route({type: 'orders/nested/set-value', value: 1})

    expect(dispatch).toHaveBeenCalledWith({
      type: 'orders/nested.BRANCH/set-value',
      value: 1,
    })
  })

  it('rejects missing workspace and invalid action types', () => {
    expect(() => createWorkspaceActionDispatcher({
      routeContext: undefined as never,
      dispatch: () => undefined,
    })).toThrow('routeContext.workspace is required')
    expect(() => createWorkspaceActionDispatcher({
      routeContext: {workspace: 'MAIN'},
      dispatch: () => undefined,
    })({type: 'missingSlash'})).toThrow('invalid action type')
  })

  it('expands descriptors only for the workspace axis', () => {
    const registrations = toWorkspaceStateDescriptors({
      baseName: 'orders',
      reducers: {
        MAIN: exampleReducer,
        BRANCH: exampleReducer,
      },
      createDescriptor: (_workspace, sliceName, reducer) => ({
        name: sliceName,
        reducer,
        persistIntent: 'never',
        syncIntent: 'isolated',
      }),
    })

    expect(registrations.map((item) => item.name)).toEqual(['orders.MAIN', 'orders.BRANCH'])
  })
})
