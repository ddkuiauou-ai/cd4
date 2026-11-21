import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DetailSwitchCandidate } from './detail-investor-navigation';
import styles from './detail-investor-summary.module.css';

export type SecurityCardTarget = (candidate: DetailSwitchCandidate, children: ReactNode, className: string) => ReactNode;

export function SecuritySelectionCheck({ selected }: { selected?: boolean }) {
  return <span className={styles.selectedCheck} aria-hidden="true">{selected && <Check size={16} />}</span>;
}

function SecurityCardFrame({ id, selected, identity, children }: {
  id?: string; selected?: boolean; identity: ReactNode; children: ReactNode;
}) {
  return <div className={styles.securityCard} data-selected={selected || undefined} data-security-id={id}>
    {identity}{children}
  </div>;
}

export function DetailSecurityCard({ candidate, name, description, selectable, renderTarget, children }: {
  candidate?: DetailSwitchCandidate; name: ReactNode; description: ReactNode; selectable: boolean;
  renderTarget?: SecurityCardTarget; children: ReactNode;
}) {
  const selected = selectable && candidate?.selected;
  const identity = <>
    <span className={styles.cardIdentity}><strong>{name}</strong>{description && <small>{description}</small>}</span>
    <SecuritySelectionCheck selected={selected} />
  </>;
  return <SecurityCardFrame id={candidate?.securityId} selected={selected} identity={selectable && candidate?.href && renderTarget
    ? renderTarget(candidate, identity, styles.cardSelect)
    : <div className={styles.cardIdentityHeading} aria-disabled={selectable || undefined}>{identity}
      {selectable && <span className="sr-only">이 지표의 제공 이력이 없습니다.</span>}</div>}>
    {children}
  </SecurityCardFrame>;
}
