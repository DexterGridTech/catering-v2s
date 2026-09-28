import {AdminLayerFrame} from './AdminLayerFrame';
import {AdminLoginLaptop} from './AdminLoginLaptop';
import {AdminShellLaptop} from './AdminShellLaptop';

export const AdminLayerLaptop = () => (
  <AdminLayerFrame
    renderLogin={props => <AdminLoginLaptop {...props} />}
    renderAuthenticated={({onClose}) => <AdminShellLaptop onClose={onClose} />}
  />
);
