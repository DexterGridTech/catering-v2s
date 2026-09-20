import type {AdminSectionProps} from '../../types/adminSection'
import {RuntimeSection} from './RuntimeSection'

/** Compatibility renderer for old catalog fixtures; the public page is runtime/display. */
export const DisplayContextSection = ({context}: AdminSectionProps) => <RuntimeSection context={context} />
