import type {LoggerPort} from '@catering-v2s/kernel-base-platform-ports'
import {useRenderContext} from '../contexts/RenderContext'

/**
 * Exposes only the render owner's structured logger to a rendered part.
 * It deliberately does not expose host geometry, platform state, or render
 * catalogs, so product components cannot infer a carrier-specific surface.
 */
export const useRenderLogger = (): LoggerPort => useRenderContext().logger
