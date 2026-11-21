import styles from '@/components/detail.module.css';
import { AppShell } from '@/components/app-shell';
import { RankingDirectoryFooter } from '@/components/ranking-directory-footer';

export default function DetailLayout({ children }: { children: React.ReactNode }) {
    return <AppShell className={styles.detail} footer={<RankingDirectoryFooter detail />}>{children}</AppShell>;
}
