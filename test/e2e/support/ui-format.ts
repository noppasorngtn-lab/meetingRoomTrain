// ADR-016 (screens.json UI-mrr-004/005/006/008): the app reads and types dates as วว/ดด/ปปปป (Gregorian year) and
// times as 24-hour HH:MM on every machine — no browser date inputs any more. The specs keep their values in the
// app's internal form (URLs and api bodies still use it) and convert only at the box a person types into.
export const uiDate = (iso: string) => iso.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1');
export const uiDateTime = (local: string) => local.replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/, '$3/$2/$1 $4');
