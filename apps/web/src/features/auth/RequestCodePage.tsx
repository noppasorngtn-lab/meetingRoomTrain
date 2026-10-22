import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe } from '../../shared/me';
import { routeOf } from '../../shared/sitemap';
import { NoticeBox } from './NoticeBox';
import { Notice, noticeOf, rememberEmail, requestCode } from './sign-in';

const VERIFY = 'UI-mrr-002';
const SEARCH = 'UI-mrr-004';
/** UI-mrr-001 overflow — an email longer than this is not taken. */
const EMAIL_MAX = 254;

/**
 * UI-mrr-001 — a person types their organisation email and asks for a code (API-031). Whatever the
 * email, a request that did not fail says the same thing (BR-mrr-026); somebody already signed in
 * is taken to the room search instead.
 */
export function RequestCodePage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let live = true;
    getMe()
      .then(() => live && navigate(routeOf(SEARCH), { replace: true }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setSending(true);
    setNotice(null);
    try {
      const sent = await requestCode(value);
      rememberEmail(value);
      navigate(routeOf(VERIFY), { state: { email: value, notice: { tone: 'info', text: sent.message } } });
    } catch (err) {
      setNotice(noticeOf(err));
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <h1>ขอรหัสเข้าสู่ระบบ</h1>
      {notice && <NoticeBox notice={notice} />}
      <div className="field">
        <label htmlFor="ui-mrr-001-org-email">
          Email องค์กร<span className="req" aria-hidden="true">*</span>
        </label>
        <input
          className="input"
          id="ui-mrr-001-org-email"
          type="email"
          autoComplete="email"
          maxLength={EMAIL_MAX}
          required
          disabled={sending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="ui-mrr-001-org-email"
          aria-describedby="ui-mrr-001-org-email-help"
        />
        <span className="help" id="ui-mrr-001-org-email-help">
          ระบบจะส่งรหัสเข้าสู่ระบบไปที่ Email นี้
        </span>
      </div>
      {sending && (
        <p className="help" role="status">
          กำลังส่งรหัส…
        </p>
      )}
      <div className="actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={sending || !email.trim()}
          aria-busy={sending}
          data-testid="ui-mrr-001-request-code"
        >
          ขอรหัสเข้าสู่ระบบ
        </button>
      </div>
    </form>
  );
}
