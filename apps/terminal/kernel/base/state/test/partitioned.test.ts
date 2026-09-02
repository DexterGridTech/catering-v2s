import {describe, expect, it, vi} from 'vitest'
import {
  createPartitionedActionDispatcher,
  createPartitionedStateKeys,
  readPartitionedState,
  toPartitionedStateDescriptors,
} from '../src/index'
import {exampleReducer} from './testSupport'

describe('partitioned state support', () => {
  it('creates and reads arbitrary partition keys without knowing their union', () => {
    const keys = createPartitionedStateKeys('orders', ['LEFT', 'RIGHT'] as const)
    expect(keys).toEqual({LEFT: 'orders.LEFT', RIGHT: 'orders.RIGHT'})
    expect(readPartitionedState<'LEFT' | 'RIGHT', number>({LEFT: 1, RIGHT: 2}, 'RIGHT')).toBe(2)
  })

  it('selects a partition and dispatches the action produced for that partition', () => {
    const dispatch = vi.fn()
    let selected: 'LEFT' | 'RIGHT' = 'RIGHT'
    const route = createPartitionedActionDispatcher({
      selectPartition: () => selected,
      dispatch,
    })

    route((partition) => ({type: `orders.${partition}/set`, value: 1}))
    expect(dispatch).toHaveBeenCalledWith({type: 'orders.RIGHT/set', value: 1})
    selected = 'LEFT'
    route((partition) => ({type: `orders.${partition}/set`, value: 2}))
    expect(dispatch).toHaveBeenLastCalledWith({type: 'orders.LEFT/set', value: 2})
  })

  it('validates descriptor names while enumerating the requested partitions', () => {
    const keys = createPartitionedStateKeys('orders', ['LEFT', 'RIGHT'] as const)
    expect(() => toPartitionedStateDescriptors({
      keys: ['LEFT', 'RIGHT'] as const,
      stateKeys: keys,
      createDescriptor: (_partition, stateKey) => ({
        name: stateKey,
        reducer: exampleReducer,
        persistIntent: 'never',
        syncIntent: 'isolated',
      }),
    })).not.toThrow()
    expect(() => toPartitionedStateDescriptors({
      keys: ['LEFT'] as const,
      stateKeys: keys,
      createDescriptor: () => ({
        name: 'wrong',
        reducer: exampleReducer,
        persistIntent: 'never',
        syncIntent: 'isolated',
      }),
    })).toThrow('descriptor name mismatch for LEFT')
  })
})
