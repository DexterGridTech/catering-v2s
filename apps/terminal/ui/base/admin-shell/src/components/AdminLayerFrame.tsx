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
import type {AdminLoginProps} from '../hooks/useAdminLogin'

type AuthenticatedRenderer = (input: Readonly<{readonly onClose: () => void}>) => ReactNode
type LoginRenderer = (input: AdminLoginProps) => ReactNode

export type AdminLayerFrameProps = Readonly<{
  readonly renderAuthenticated: AuthenticatedRenderer
  readonly renderLogin: LoginRenderer
}>

/** Shared layer lifecycle and authentication owner; production UI is supplied by the named form renderers. */
export const AdminLayerFrame = ({renderAuthenticated, renderLogin}: AdminLayerFrameProps) => {
  const {logger, runtimeFacts} = useRenderContext()
  const surface = useSurfaceContext()
  const dispatchCommand = useDispatchCommand()
  const inputController = useInputController()
  const [authenticated, setAuthenticated] = useState(false)
  const dispatchRef = useRef(dispatchCommand)
  const loggerRef = useRef(logger)
  dispatchRef.current = dispatchCommand
  loggerRef.current = logger
  const identity = surface.surfaceIdentity
  const surfaceKey = identity?.surfaceKey ?? null
  const displayIndex = identity?.displayIndex ?? null
  const identityDisplayMode = identity?.displayMode ?? surface.displayMode

  useEffect(() => {
    return () => {
      const request = dispatchWithRequestId({
        dispatchCommand: dispatchRef.current,
        definition: closeLayerCommand,
        routeIntent: 'peer-intent',
        payload: {displayMode: identityDisplayMode, layerId: ADMIN_CONSOLE_LAYER_ID},
      })
      void request.then(result => {
        loggerRef.current.info({
          category: 'admin.layer',
          event: 'admin.layer-close-on-unmount-result',
          message: 'Admin layer unmount close dispatch completed',
          data: {
            displayMode: identityDisplayMode,
            displayIndex,
            surfaceKey,
            routeIntent: 'peer-intent',
            status: result.status,
          },
        })
      }).catch(() => {
        loggerRef.current.error({
          category: 'admin.layer',
          event: 'admin.layer-close-on-unmount-failed',
          message: 'Admin layer unmount close dispatch failed',
          data: {
            displayMode: identityDisplayMode,
            displayIndex,
            surfaceKey,
            routeIntent: 'peer-intent',
          },
        })
      })
    }
  }, [displayIndex, identityDisplayMode, surfaceKey])

  useLayoutEffect(() => {
    inputController.activateFocusScope(ADMIN_CONSOLE_FOCUS_SCOPE_ID)
    return () => {
      inputController.activateFocusScope(BUSINESS_FOCUS_SCOPE_ID)
    }
  }, [inputController])

  const close = useCallback(() => {
    const request = dispatchWithRequestId({
      dispatchCommand,
      definition: closeLayerCommand,
      routeIntent: 'peer-intent',
      payload: {displayMode: surface.displayMode, layerId: ADMIN_CONSOLE_LAYER_ID},
    })
    void request.then(result => {
      logger.info({
        category: 'admin.layer',
        event: 'admin.layer-close-result',
        message: 'Admin layer close dispatch completed',
        data: {
          displayMode: surface.displayMode,
          displayIndex,
          surfaceKey,
          routeIntent: 'peer-intent',
          status: result.status,
        },
      })
      if (result.status !== 'completed') {
        logger.warn({
          category: 'admin.layer',
          event: 'admin.layer-close-failed',
          message: 'Admin layer close dispatch returned a non-completed result',
          data: {
            displayMode: surface.displayMode,
            displayIndex,
            surfaceKey,
            routeIntent: 'peer-intent',
            status: result.status,
            reason: 'command-not-completed',
          },
        })
      }
    }).catch(() => {
      logger.error({
        category: 'admin.layer',
        event: 'admin.layer-close-failed',
        message: 'Admin layer close dispatch failed',
        data: {
          displayMode: surface.displayMode,
          displayIndex,
          surfaceKey,
          routeIntent: 'peer-intent',
        },
      })
    })
  }, [displayIndex, dispatchCommand, logger, surface.displayMode, surfaceKey])

  if (!authenticated) {
    return renderLogin({
      identity: runtimeFacts.deviceIdentity,
      debugMode: runtimeFacts.debugMode,
      showAdminPassword: runtimeFacts.showAdminPassword,
      onAuthenticated: () => setAuthenticated(true),
      onClose: close,
    })
  }
  return <>{renderAuthenticated({onClose: close})}</>
}
