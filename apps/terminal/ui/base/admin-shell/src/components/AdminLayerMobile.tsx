import {AdminLayerFrame} from './AdminLayerFrame';
import {AdminLoginMobile} from './AdminLoginMobile';
import {AdminShellMobile} from './AdminShellMobile';

export const AdminLayerMobile = () => (
  <AdminLayerFrame
    renderLogin={props => <AdminLoginMobile {...props} />}
    renderAuthenticated={({onClose}) => <AdminShellMobile onClose={onClose} />}
  />
);
