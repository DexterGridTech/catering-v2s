import {AdminLayerFrame} from './AdminLayer'
import {AdminShellLaptop} from './AdminShellLaptop'

export const AdminLayerLaptop = () => (
  <AdminLayerFrame renderAuthenticated={({onClose}) => <AdminShellLaptop onClose={onClose} />} />
)
