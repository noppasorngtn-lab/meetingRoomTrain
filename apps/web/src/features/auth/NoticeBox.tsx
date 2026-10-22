import { Notice } from './sign-in';

/** One sentence above the form: the api's own words, never rephrased (AC-mrr-089..103). */
export function NoticeBox({ notice }: { notice: Notice }) {
  return (
    <div role={notice.tone === 'info' ? 'status' : 'alert'} className={`alert alert-${notice.tone}`}>
      <span className="alert-title">{notice.text}</span>
    </div>
  );
}
