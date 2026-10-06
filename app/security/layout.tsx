import styles from '@/components/detail.module.css';
import { AppShell } from '@/components/app-shell';

export default function DetailLayout({ children }: { children: React.ReactNode }) {
    return <AppShell className={styles.detail}>{children}</AppShell>;
}
