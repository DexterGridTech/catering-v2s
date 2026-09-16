import {AdminLayerFrame} from './AdminLayer'
import {AdminShellMobile} from './AdminShellMobile'

export const AdminLayerMobile = () => (
  <AdminLayerFrame renderAuthenticated={({onClose}) => <AdminShellMobile onClose={onClose} />} />
)
