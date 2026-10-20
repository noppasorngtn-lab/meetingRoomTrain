import { Outlet } from 'react-router-dom';
import { PRODUCT_NAME } from '../../shared/sitemap';

/** Sign-in, code and sign-out pages: no menu, just the product name above a centred panel (MV29). */
export function AuthLayout() {
  return (
    <div className="auth">
      <div className="card">
        <p className="product">{PRODUCT_NAME}</p>
        <Outlet />
      </div>
    </div>
  );
}
