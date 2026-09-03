import {createElement} from 'react'
import {describe, expect, it} from 'vitest'

describe('render test wiring', () => {
  it('collects TSX tests with the package runner', () => {
    const probe = createElement('render-test-probe', {testID: 'tsx-collected'})

    expect(probe.props.testID).toBe('tsx-collected')
  })
})
