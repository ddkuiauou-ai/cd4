export const COMPANY_HEADER_PIN_EVENT = "company-header-pin-change" as const;

export type CompanyHeaderPinEventDetail = {
    pinned: boolean;
    offset?: number;
};

export type CompanyHeaderPinEvent = CustomEvent<CompanyHeaderPinEventDetail>;

