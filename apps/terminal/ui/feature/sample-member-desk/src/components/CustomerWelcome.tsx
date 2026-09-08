import {useCallback, type ComponentProps} from 'react'
import {useRenderLogger} from '@catering-v2s/ui-base-render'
import {
  PrimitiveContainer,
  PrimitiveStatus,
} from '@catering-v2s/ui-base-primitives'

type StatusProps = ComponentProps<typeof PrimitiveStatus>
type StatusLayoutEvent = Parameters<NonNullable<StatusProps['onLayout']>>[0]
type StatusTextLayoutEvent = Parameters<NonNullable<StatusProps['onTextLayout']>>[0]

export const CustomerWelcome = () => {
  const logger = useRenderLogger()
  const onLayout = useCallback((event: StatusLayoutEvent) => {
    if (!__DEV__) return
    const {x, y, width, height} = event.nativeEvent.layout
    logger.info({
      category: 'display-diagnostics',
      event: 'sample.customer-welcome-text-layout',
      message: 'Secondary welcome Text layout observed',
      data: {x, y, width, height, units: 'logical-layout-unit'},
    })
  }, [logger])
  const onTextLayout = useCallback((event: StatusTextLayoutEvent) => {
    if (!__DEV__) return
    logger.info({
      category: 'display-diagnostics',
      event: 'sample.customer-welcome-text-lines',
      message: 'Secondary welcome Text line metrics observed',
      data: {
        units: 'logical-layout-unit',
        lines: event.nativeEvent.lines.map(line => ({
          text: line.text,
          x: line.x,
          y: line.y,
          width: line.width,
          height: line.height,
          ascender: line.ascender,
          descender: line.descender,
          capHeight: line.capHeight,
          xHeight: line.xHeight,
        })),
      },
    })
  }, [logger])
  return (
    <PrimitiveContainer testID="sample.desk.customer-welcome" layout="centered">
      <PrimitiveStatus
        testID="sample.desk.customer-welcome:message"
        onLayout={onLayout}
        onTextLayout={onTextLayout}
      >
        欢迎，请等待店员操作
      </PrimitiveStatus>
    </PrimitiveContainer>
  )
}
