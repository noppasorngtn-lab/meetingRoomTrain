import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormattedInput } from '../shared/FormattedInput';
import {
  displayDate, displayDateTime, displayTime, parseDate, parseDateTime, parseTime,
} from '../shared/time';

// ADR-016 · screens.json UI-mrr-004/005/006/008: วว/ดด/ปปปป (Gregorian year) and 24-hour HH:MM on every machine.
describe('FE-mrr-002 · FE-mrr-003 · FE-mrr-004 · FE-mrr-042 ADR-016 date and time text', () => {
  it('shows an internal date as DD/MM/YYYY and reads it back', () => {
    expect(displayDate('2031-03-05')).toBe('05/03/2031');
    expect(parseDate('05/03/2031')).toBe('2031-03-05');
    expect(parseDate('5/3/2031')).toBe('2031-03-05'); // one digit accepted, shown padded
    expect(displayDate(parseDate('5/3/2031')!)).toBe('05/03/2031');
  });

  it('accepts 29/02 only in a leap year, and never a day the month does not have', () => {
    expect(parseDate('29/02/2028')).toBe('2028-02-29');
    expect(parseDate('29/02/2027')).toBeNull();
    expect(parseDate('31/04/2031')).toBeNull();
    expect(parseDate('00/04/2031')).toBeNull();
    expect(parseDate('10/13/2031')).toBeNull(); // month first is not a date here
  });

  it('refuses a 2-digit year, another separator, and empty text', () => {
    expect(parseDate('05/03/31')).toBeNull();
    expect(parseDate('2031-03-05')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(displayDate('')).toBe('');
  });

  it('reads 24-hour times 00:00-23:59 only', () => {
    expect(parseTime('09:05')).toBe('09:05');
    expect(parseTime('9:05')).toBe('09:05');
    expect(parseTime('23:59')).toBe('23:59');
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
    expect(parseTime('9.05')).toBeNull();
    expect(displayTime('14:00')).toBe('14:00');
  });

  it('joins the two for a date and time', () => {
    expect(displayDateTime('2099-10-17T14:00')).toBe('17/10/2099 14:00');
    expect(parseDateTime('17/10/2099 14:00')).toBe('2099-10-17T14:00');
    expect(parseDateTime('17/10/2099')).toBeNull();
    expect(parseDateTime('31/04/2099 14:00')).toBeNull();
    expect(displayDateTime('')).toBe('');
  });
});

function Harness({ initial, kind }: { initial: string; kind: 'date' | 'time' | 'datetime' }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <FormattedInput id="x-field" name="วันที่" kind={kind} value={value} onChange={setValue} />
      <output data-testid="x-value">{value}</output>
      <button type="button" onClick={() => setValue('2031-12-01')}>set</button>
    </>
  );
}

describe('FE-mrr-002 · FE-mrr-003 · FE-mrr-004 · FE-mrr-042 ADR-016 FormattedInput', () => {
  it('is a text box carrying its testid, the format as placeholder, and the help line', () => {
    render(<Harness initial="2031-03-05" kind="date" />);
    const box = screen.getByTestId('x-field');
    expect(box).toHaveAttribute('type', 'text');
    expect(box).toHaveValue('05/03/2031');
    expect(box).toHaveAttribute('placeholder', 'วว/ดด/ปปปป');
    expect(screen.getByText('รูปแบบ วว/ดด/ปปปป (ปี ค.ศ.)')).toHaveAttribute('id', 'x-field-format');
    expect(box).toHaveAttribute('aria-describedby', 'x-field-format');
  });

  it('reports the internal value once the text is valid, and keeps half-typed text on screen', () => {
    render(<Harness initial="" kind="date" />);
    const box = screen.getByTestId('x-field');
    fireEvent.change(box, { target: { value: '05/03/20' } });
    expect(box).toHaveValue('05/03/20');
    expect(screen.getByTestId('x-value')).toHaveTextContent(/^$/);
    fireEvent.change(box, { target: { value: '05/03/2031' } });
    expect(screen.getByTestId('x-value')).toHaveTextContent('2031-03-05');
  });

  it('shows a value set from outside', () => {
    render(<Harness initial="2031-03-05" kind="date" />);
    fireEvent.click(screen.getByText('set'));
    expect(screen.getByTestId('x-field')).toHaveValue('01/12/2031');
  });
});
