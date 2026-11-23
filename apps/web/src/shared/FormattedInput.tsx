import { useEffect, useState } from 'react';
import {
  displayDate, displayDateTime, displayTime, parseDate, parseDateTime, parseTime,
} from './time';

/**
 * A date / time / date-and-time box that reads and types วว/ดด/ปปปป and 24-hour HH:MM on every machine
 * (ADR-016 · screens.json UI-mrr-004/005/006/008) — the browser's own date inputs follow the machine's
 * language instead. The value going in and out stays the app's internal form (YYYY-MM-DD · HH:MM ·
 * YYYY-MM-DDTHH:MM); text that is not a valid value yet is reported as ''.
 * The help line under the box is the one the mockups carry (mockups/UI-mrr-00x/*.html, `<id>-format`).
 */
export type FormattedKind = 'date' | 'time' | 'datetime';

const FORMAT: Record<FormattedKind, { parse: (t: string) => string | null; display: (v: string) => string; placeholder: string; help: string }> = {
  date: { parse: parseDate, display: displayDate, placeholder: 'วว/ดด/ปปปป', help: 'รูปแบบ วว/ดด/ปปปป (ปี ค.ศ.)' },
  time: { parse: parseTime, display: displayTime, placeholder: 'HH:MM', help: 'รูปแบบ HH:MM (24 ชั่วโมง)' },
  datetime: {
    parse: parseDateTime, display: displayDateTime, placeholder: 'วว/ดด/ปปปป HH:MM',
    help: 'รูปแบบ วว/ดด/ปปปป HH:MM (ปี ค.ศ. · 24 ชั่วโมง)',
  },
};

export function FormattedInput(props: {
  id: string;
  name: string;
  kind: FormattedKind;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  errorId?: string;
}) {
  const { id, name, kind, value, onChange, required, placeholder, errorId } = props;
  const f = FORMAT[kind];
  const [text, setText] = useState(() => f.display(value));

  // A value set from outside (a booking loaded for editing, a date picked by another control) replaces the
  // text; a value that is '' only because the text is still being typed must not wipe what was typed.
  useEffect(() => {
    if (value && f.parse(text) !== value) setText(f.display(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatId = `${id}-format`;
  return (
    <>
      <input
        className="input"
        id={id}
        type="text"
        name={name}
        data-testid={id}
        value={text}
        placeholder={placeholder ?? f.placeholder}
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value);
          onChange(f.parse(e.target.value) ?? '');
        }}
        required={required}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId ? `${formatId} ${errorId}` : formatId}
      />
      <span className="help" id={formatId}>{f.help}</span>
    </>
  );
}
