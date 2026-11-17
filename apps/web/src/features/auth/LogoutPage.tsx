import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postJson } from '../../shared/api';
import { routeOf } from '../../shared/sitemap';

type State = 'signing-out' | 'done' | 'failed';

/** sign-in-again's destinationRef in screens.json. */
const SIGN_IN = 'UI-mrr-001';

/**
 * UI-mrr-003 — ends the viewer's own session (API-034) and says so. The api answers the same for
 * someone who was never signed in (AC-mrr-113), so the page never asks who that was. Until the
 * session is really ended it does not say "ออกจากระบบแล้ว" (AC-mrr-112 · the loading and error states).
 */
export function LogoutPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>('signing-out');

  useEffect(() => {
    let current = true;
    postJson('/auth/logout', {})
      .then(() => current && setState('done'))
      .catch(() => current && setState('failed'));
    return () => {
      current = false;
    };
  }, []);

  return (
    <>
      <h1>ออกจากระบบ</h1>
      {state === 'signing-out' && (
        <p className="help" role="status">
          กำลังออกจากระบบ…
        </p>
      )}
      {state === 'failed' && (
        <div role="alert" className="alert alert-danger">
          <span className="alert-title">ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง</span>
        </div>
      )}
      {state === 'done' && (
        <>
          <p data-testid="ui-mrr-003-confirmation-message">ออกจากระบบแล้ว</p>
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              data-testid="ui-mrr-003-sign-in-again"
              onClick={() => navigate(routeOf(SIGN_IN))}
            >
              เข้าสู่ระบบอีกครั้ง
            </button>
          </div>
        </>
      )}
    </>
  );
}
