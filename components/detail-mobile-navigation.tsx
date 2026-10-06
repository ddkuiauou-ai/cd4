import { ChevronDown } from 'lucide-react';
import { PageNavigation } from './page-navigation';

export function DetailMobileNavigation({ sections }: { sections: Array<{ id: string; label: string }> }) {
    return <details className="detail-mobile-context xl:hidden">
        <summary>이 페이지에서 <ChevronDown className="ml-auto h-4 w-4" aria-hidden="true" /></summary>
        <PageNavigation sections={sections} collapsible={false} />
    </details>;
}
