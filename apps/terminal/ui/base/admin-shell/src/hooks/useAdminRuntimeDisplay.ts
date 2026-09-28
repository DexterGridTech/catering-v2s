import {useRenderStatus} from '@catering-v2s/ui-base-render'
import type {AdminSectionRenderContext} from '../types/adminSection'
import {runtimeFrameId, useReportAdminFrame} from '../foundations/adminFrameRegistry'
import {projectRuntimeDisplay} from '../foundations/runtimeDisplay'

export type AdminRuntimeDisplayInput = Readonly<{
  readonly context: AdminSectionRenderContext
  readonly surfaceForm: 'laptop' | 'mobile'
}>

const renderStatusLabel = (status: ReturnType<typeof useRenderStatus>): string => status === 'started' ? '正常' : status === 'created' ? '正在准备' : '不可用'

/** Shared runtime/display facts projection; Laptop/Mobile components own the visual composition. */
export const useAdminRuntimeDisplay = ({context, surfaceForm}: AdminRuntimeDisplayInput) => {
  const facts = context.runtimeFacts
  const status = useRenderStatus()
  const display = projectRuntimeDisplay({
    facts: facts.displayFacts,
    surfaceCanvasSizes: facts.surfaceCanvasSizes ?? {},
    surfaceForm,
    renderDisplayMode: context.surface.displayMode,
    currentLogicalSize: context.surface.hostLogicalSize,
  })
  const frameId = runtimeFrameId(surfaceForm, facts.displayFacts)
  useReportAdminFrame(frameId)
  const physicalDisplayCount = facts.displayFacts?.physicalDisplayCount
  const displayCountLabel = physicalDisplayCount === null || physicalDisplayCount === undefined ? '未知' : String(physicalDisplayCount)
  const overallMessage = status === 'started'
    ? displayCountLabel === '2' ? '运行正常 · 检测到两块物理屏' : '运行正常 · 检测到一块物理屏'
    : `运行状态：${renderStatusLabel(status)}`

  return {
    context,
    facts,
    status,
    display,
    displayCountLabel,
    overallMessage,
  }
}
