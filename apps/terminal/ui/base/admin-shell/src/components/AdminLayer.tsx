import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {closeLayerCommand} from '@catering-v2s/kernel-base-ui-state'
import {BUSINESS_FOCUS_SCOPE_ID, useInputController} from '@catering-v2s/ui-base-input'
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useRenderContext,
  useSurfaceContext,
} from '@catering-v2s/ui-base-render'
import {
  ADMIN_CONSOLE_FOCUS_SCOPE_ID,
  ADMIN_CONSOLE_LAYER_ID,
} from '../foundations/adminIdentity'
import {AdminLogin} from './AdminLogin'
import {AdminShell} from './AdminShell'

export const AdminLayer = () => {
  const {runtimeFacts} = useRenderContext()
  const surface = useSurfaceContext()
  const dispatchCommand = useDispatchCommand()
  const inputController = useInputController()
  const [authenticated, setAuthenticated] = useState(false)
  const dispatchRef = useRef(dispatchCommand)
  dispatchRef.current = dispatchCommand
  const identity = surface.surfaceIdentity
  const surfaceKey = identity?.surfaceKey ?? null
  const displayIndex = identity?.displayIndex ?? null
  const surfaceForm = identity?.surfaceForm ?? surface.surfaceForm
  const identityDisplayMode = identity?.displayMode ?? surface.displayMode

  useEffect(() => {
    return () => {
      void dispatchWithRequestId({
        dispatchCommand: dispatchRef.current,
        definition: closeLayerCommand,
        payload: {displayMode: identityDisplayMode, layerId: ADMIN_CONSOLE_LAYER_ID},
      }).catch(() => undefined)
    }
  }, [displayIndex, identityDisplayMode, surfaceForm, surfaceKey])

  useLayoutEffect(() => {
    inputController.activateFocusScope(ADMIN_CONSOLE_FOCUS_SCOPE_ID)
    return () => inputController.activateFocusScope(BUSINESS_FOCUS_SCOPE_ID)
  }, [inputController])

  const close = useCallback(() => {
    void dispatchWithRequestId({
      dispatchCommand,
      definition: closeLayerCommand,
      payload: {displayMode: surface.displayMode, layerId: ADMIN_CONSOLE_LAYER_ID},
    }).catch(() => undefined)
  }, [dispatchCommand, surface.displayMode])

  if (!authenticated) {
    return (
      <AdminLogin
        identity={runtimeFacts.deviceIdentity}
        debugMode={runtimeFacts.debugMode}
        onAuthenticated={() => setAuthenticated(true)}
        onClose={close}
      />
    )
  }
  return <AdminShell onClose={close} />
}
