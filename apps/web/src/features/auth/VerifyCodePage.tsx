import { FormEvent, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, postJson } from '../../shared/api';
import { routeOf } from '../../shared/sitemap';
import { NoticeBox } from './NoticeBox';
import { Notice, noticeOf, rememberedEmail, requestCode } from './sign-in';

const REQUEST = 'UI-mrr-001';
const SEARCH = 'UI-mrr-004';
/** A code is six digits (BR-mrr-027) — UI-mrr-002 overflow does not occur. */
const CODE_LENGTH = 6;

/** A magic link that could not be used lands here with its reason (API-033) — the same sentence the code would get. */
const LINK_REFUSED: Record<string, string> = {
  expired: 'รหัสหรือลิงก์เข้าสู่ระบบหมดอายุแล้ว กรุณาขอรหัสใหม่',
  used: 'รหัสหรือลิงก์นี้ถูกใช้เข้าสู่ระบบไปแล้ว กรุณาขอรหัสใหม่',
  wrong: 'รหัสไม่ถูกต้อง กรุณาตรวจสอบรหัสใน Email แล้วกรอกใหม่',
};

/**
 * UI-mrr-002 — the code from the email opens a session (API-032) and the room search; a wrong code
 * can be typed again (BR-mrr-028). A new code is only issued once the old one expired or was used
 * (BR-mrr-025) — the api says so when it is not.
 */
export function VerifyCodePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const state = (location.state ?? {}) as { email?: string; notice?: Notice };
  const email = state.email ?? rememberedEmail();
  const linkRefused = LINK_REFUSED[params.get('reason') ?? ''];

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'verify' | 'resend' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(
    linkRefused ? { tone: 'danger', text: linkRefused } : state.notice ?? null,
  );

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || code.length !== CODE_LENGTH) return;
    setBusy('verify');
    setNotice(null);
    try {
      await postJson('/auth/otp/verify', { email, code });
      navigate(routeOf(SEARCH), { replace: true });
    } catch (err) {
      setNotice(
        err instanceof ApiError && err.status !== 500 && err.message
          ? { tone: 'danger', text: err.message }
          : { tone: 'danger', text: LINK_REFUSED.wrong },
      );
      setBusy(null);
    }
  };

  const resend = async () => {
    // With no email to send to — a link opened in another browser — the code is asked for again there.
    if (!email) return navigate(routeOf(REQUEST));
    setBusy('resend');
    setNotice(null);
    try {
      const sent = await requestCode(email);
      setCode('');
      setNotice({ tone: 'info', text: sent.message });
    } catch (err) {
      setNotice(noticeOf(err));
    }
    setBusy(null);
  };

  return (
    <form onSubmit={verify} noValidate>
      <h1>ยืนยันรหัส OTP</h1>
      {notice && <NoticeBox notice={notice} />}
      <div className="field">
        <span className="label" id="ui-mrr-002-requested-email-label">
          Email ที่ขอรหัส
        </span>
        <p className="value" aria-labelledby="ui-mrr-002-requested-email-label" data-testid="ui-mrr-002-requested-email">
          {email ?? ''}
        </p>
      </div>
      <div className="field">
        <label htmlFor="ui-mrr-002-otp-code">
          รหัส OTP<span className="req" aria-hidden="true">*</span>
        </label>
        <input
          className="input"
          id="ui-mrr-002-otp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          required
          disabled={busy !== null || !email}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          data-testid="ui-mrr-002-otp-code"
          aria-describedby="ui-mrr-002-otp-code-help"
        />
        <span className="help" id="ui-mrr-002-otp-code-help">
          ตัวเลข 6 หลักจาก Email
        </span>
      </div>
      {busy && (
        <p className="help" role="status">
          {busy === 'verify' ? 'กำลังตรวจรหัส…' : 'กำลังส่งรหัส…'}
        </p>
      )}
      <div className="actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy !== null || !email || code.length !== CODE_LENGTH}
          aria-busy={busy === 'verify'}
          data-testid="ui-mrr-002-verify"
        >
          เข้าสู่ระบบ
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={resend} data-testid="ui-mrr-002-resend">
          ขอรหัสใหม่
        </button>
      </div>
    </form>
  );
}
