'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';

interface SearchBarProps {
    placeholder?: string;
    className?: string;
}

/**
 * Enhanced SearchBar component for CD3 project
 * Mobile-first design with animated transitions
 */
function SearchBar({ placeholder = '종목명, 종목코드 검색', className }: SearchBarProps) {
    const [query, setQuery] = React.useState('');
    const [isFocused, setIsFocused] = React.useState(false);
    const router = useRouter();
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Handle search submission
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            router.push(`/screener?q=${encodeURIComponent(query.trim())}`);
        }
    };

    // Handle input focus with animation
    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
    };

    return (
        <form
            onSubmit={handleSearch}
            className={`relative w-full max-w-md transition-all duration-300 group ${className} ${isFocused ? 'scale-[1.02]' : ''
                }`}
        >
            <div className="relative flex w-full items-center">
                <Input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    className="w-full pr-10 transition-shadow duration-300 border-primary/20 focus-visible:border-primary/40"
                    aria-label="검색"
                />
                <Button
                    type="submit"
                    size="icon"
                    variant="ghost"
                    className="absolute right-0 h-full px-3 text-muted-foreground hover:text-primary"
                >
                    <Search className="h-4 w-4" />
                </Button>
            </div>

            {/* Animated focus indicator */}
            <div
                className={`absolute bottom-0 left-1/2 h-0.5 bg-primary transform -translate-x-1/2 transition-all duration-300 rounded ${isFocused ? 'w-full opacity-100' : 'w-0 opacity-0'
                    }`}
            ></div>
        </form>
    );
}

export default SearchBar;
