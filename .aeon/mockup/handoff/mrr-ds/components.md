# mrr — component list

| Component | Brief family | Count in brief | Variants / states | Interaction-state tokens |
|---|---|---|---|---|
| Button | button | 37 | primary · secondary · quiet · danger; md 44px / sm 36px; loading | normal `primary`/`surface-raised`/`danger` · hover `primary-hover`/`surface-hover`/`danger-hover` · active `primary-active`/`surface-pressed` · focus `focus-ring` · disabled `disabled-fill`+`disabled-ink` · error n/a |
| TextField | input | 30 | text · email · date · time · number; hint; maxLength counter (200/254/100) | normal `border-strong` · hover `ink-muted` · active n/a · focus `focus-ring` · disabled `disabled-fill`+`disabled-ink` · error `danger` (2px) + message |
| Table | table | 8 | ready · loading (skeleton) · empty · error (retry); truncate + title; pagination 20/50; selected row | row hover `surface-hover` · selected `primary-tint` · page button focus `focus-ring` · current page `primary` · disabled `disabled-fill` |
| Alert | alert | 15 | info · success · warning · danger; title, body, one action | tone grounds `primary-tint`/`success-tint`/`warning-tint`/`danger-tint`; text `on-primary-tint`/`success`/`warning`/`danger` |

Screen states covered: empty → Table `empty` · loading → Table `loading`, Button `loading` · error → Alert `danger`, Table `error`, TextField `error` · overflow → Table pagination + truncation, TextField counter · unauthorized → Alert `danger` with เข้าสู่ระบบอีกครั้ง.

Calendar slot states (UI-mrr-005) use tokens only, no new component: free `surface-raised`+`border` · others' booking `primary-tint`/`on-primary-tint` · mine `primary`/`on-primary` · pending `warning-tint`/`warning` · closed `surface-sunken`/`ink-muted` · '+N' = Button quiet sm.

No tokens missing for the six interaction states (normal · hover · active · focus · disabled · error).
