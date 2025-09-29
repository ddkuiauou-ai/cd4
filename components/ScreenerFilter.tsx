'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    ChevronDown,
    SlidersHorizontal,
    RotateCcw,
    Filter,
    Check
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FilterOption {
    id: string;
    label: string;
    options?: { value: string; label: string }[];
    range?: { min: number; max: number; step: number; unit: string };
    checkboxes?: { value: string; label: string }[];
}

interface ScreenerFilterProps {
    title?: string;
    description?: string;
    filterOptions: FilterOption[];
    onFilterChange: (filters: Record<string, any>) => void;
    className?: string;
    activeFilters?: number;
}

/**
 * ScreenerFilter component provides investment screening tools
 * Following CD3 mobile-first and user-centric design
 */
function ScreenerFilter({
    title = "투자 스크리너",
    description = "원하는 조건에 맞는 종목을 찾아보세요",
    filterOptions,
    onFilterChange,
    className,
    activeFilters = 0,
}: ScreenerFilterProps) {
    // Initialize filter values based on provided options
    const [filters, setFilters] = useState<Record<string, any>>(() => {
        const initialFilters: Record<string, any> = {};

        filterOptions.forEach(option => {
            if (option.options) {
                initialFilters[option.id] = "";
            } else if (option.range) {
                initialFilters[option.id] = [option.range.min, option.range.max];
            } else if (option.checkboxes) {
                initialFilters[option.id] = [];
            }
        });

        return initialFilters;
    });

    // Handle filter value changes
    const handleFilterChange = (id: string, value: any) => {
        setFilters(prev => {
            const newFilters = { ...prev, [id]: value };
            onFilterChange(newFilters);
            return newFilters;
        });
    };

    // Reset all filters to default values
    const handleReset = () => {
        const resetFilters: Record<string, any> = {};

        filterOptions.forEach(option => {
            if (option.options) {
                resetFilters[option.id] = "";
            } else if (option.range) {
                resetFilters[option.id] = [option.range.min, option.range.max];
            } else if (option.checkboxes) {
                resetFilters[option.id] = [];
            }
        });

        setFilters(resetFilters);
        onFilterChange(resetFilters);
    };

    // Apply current filters
    const handleApply = () => {
        onFilterChange(filters);
    };

    return (
        <Card className={cn("w-full", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <SlidersHorizontal className="h-5 w-5" />
                            {title}
                            {activeFilters > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                    {activeFilters}
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-2 pb-0 sm:px-6">
                <Accordion type="multiple" className="w-full">
                    {filterOptions.map((option) => (
                        <AccordionItem key={option.id} value={option.id}>
                            <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                <span className="text-base font-medium">{option.label}</span>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 pt-1">
                                {option.options && (
                                    <Select
                                        value={filters[option.id] || ""}
                                        onValueChange={(value) => handleFilterChange(option.id, value)}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="선택하세요" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">전체</SelectItem>
                                            {option.options.map((item) => (
                                                <SelectItem key={item.value} value={item.value}>
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                {option.range && (
                                    <div className="space-y-4">
                                        <Slider
                                            defaultValue={[option.range.min, option.range.max]}
                                            min={option.range.min}
                                            max={option.range.max}
                                            step={option.range.step}
                                            value={filters[option.id]}
                                            onValueChange={(value) => handleFilterChange(option.id, value)}
                                            className="py-4"
                                        />
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm">
                                                {filters[option.id][0]} {option.range.unit}
                                            </span>
                                            <span className="text-sm">
                                                {filters[option.id][1]} {option.range.unit}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {option.checkboxes && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {option.checkboxes.map((item) => (
                                            <div key={item.value} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`${option.id}-${item.value}`}
                                                    checked={filters[option.id]?.includes(item.value)}
                                                    onCheckedChange={(checked) => {
                                                        const currentValues = [...(filters[option.id] || [])];
                                                        if (checked) {
                                                            currentValues.push(item.value);
                                                        } else {
                                                            const index = currentValues.indexOf(item.value);
                                                            if (index !== -1) currentValues.splice(index, 1);
                                                        }
                                                        handleFilterChange(option.id, currentValues);
                                                    }}
                                                />
                                                <label
                                                    htmlFor={`${option.id}-${item.value}`}
                                                    className="text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                >
                                                    {item.label}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>

            <CardFooter className="flex justify-between gap-2 pt-4">
                <Button
                    variant="outline"
                    onClick={handleReset}
                    className="flex-1"
                >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    초기화
                </Button>
                <Button
                    variant="default"
                    onClick={handleApply}
                    className="flex-1"
                >
                    <Filter className="h-4 w-4 mr-2" />
                    필터 적용
                </Button>
            </CardFooter>
        </Card>
    );
}

export default ScreenerFilter;
