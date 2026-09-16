import {useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react'
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

type AuthenticatedRenderer = (input: Readonly<{readonly onClose: () => void}>) => ReactNode

type AdminLayerFrameProps = Readonly<{
  readonly renderAuthenticated: AuthenticatedRenderer
}>

const renderAdminLayer = ({renderAuthenticated}: AdminLayerFrameProps) => {
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
  const identityDisplayMode = identity?.displayMode ?? surface.displayMode

  useEffect(() => {
    return () => {
      void dispatchWithRequestId({
        dispatchCommand: dispatchRef.current,
        definition: closeLayerCommand,
        payload: {displayMode: identityDisplayMode, layerId: ADMIN_CONSOLE_LAYER_ID},
      }).catch(() => undefined)
    }
  }, [displayIndex, identityDisplayMode, surfaceKey])

  useLayoutEffect(() => {
    inputController.activateFocusScope(ADMIN_CONSOLE_FOCUS_SCOPE_ID)
    return () => {
      inputController.activateFocusScope(BUSINESS_FOCUS_SCOPE_ID)
    }
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
        showAdminPassword={runtimeFacts.showAdminPassword}
        onAuthenticated={() => setAuthenticated(true)}
        onClose={close}
      />
    )
  }
  return <>{renderAuthenticated({onClose: close})}</>
}

export const AdminLayerFrame = renderAdminLayer

export const AdminLayer = () => (
  <AdminLayerFrame renderAuthenticated={({onClose}) => <AdminShell onClose={onClose} />} />
)
