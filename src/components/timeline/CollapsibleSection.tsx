import { useState } from 'react';
import s from './CollapsibleSection.module.css';

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleSection({ title, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={s.section}>
      <button className={s.toggle} onClick={() => setOpen(o => !o)}>
        <span className={s.title}>{title}</span>
        <span className={`${s.chevron} ${open ? s.chevronOpen : ''}`}>▾</span>
      </button>
      {open && <div className={s.body}>{children}</div>}
    </div>
  );
}
