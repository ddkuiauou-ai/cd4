/**
 * Static data for SSG builds
 * Used when database is not available during build time
 */

// Comprehensive list of major Korean securities for SSG fallback
export const MAJOR_KOREAN_SECURITIES = [
    // Top 20 KOSPI by market cap (as of 2024)
    'KRX.005930', // Samsung Electronics
    'KRX.000660', // SK Hynix
    'KRX.035420', // NAVER
    'KRX.005380', // Hyundai Motor
    'KRX.051910', // LG Chem
    'KRX.006400', // Samsung SDI
    'KRX.035720', // Kakao
    'KRX.096770', // SK Innovation
    'KRX.028260', // Samsung C&T
    'KRX.066570', // LG Electronics
    'KRX.012330', // Hyundai Mobis
    'KRX.003550', // LG Corp
    'KRX.017670', // SK Telecom
    'KRX.000270', // Kia
    'KRX.030200', // KT
    'KRX.105560', // KB Financial Group
    'KRX.055550', // Shinhan Financial Group
    'KRX.015760', // Korea Electric Power
    'KRX.009150', // Samsung Electro-Mechanics
    'KRX.034020', // Doosan

    // Financial sector
    'KRX.086790', // Hana Financial Group
    'KRX.024110', // Industrial Bank of Korea
    'KRX.316140', // Woori Financial Group
    'KRX.138040', // Meritz Financial Group

    // Heavy industry & chemicals
    'KRX.010130', // Korea Zinc
    'KRX.009540', // HD Korea Shipbuilding & Offshore
    'KRX.180640', // Hanwha Solutions
    'KRX.010950', // S-Oil
    'KRX.011170', // Lotte Chemical
    'KRX.001570', // Kumyang

    // Transportation & logistics
    'KRX.003490', // Korean Air
    'KRX.161390', // Hankook Tire & Technology
    'KRX.028670', // Pacific

    // Insurance
    'KRX.000810', // Samsung Fire & Marine Insurance
    'KRX.005830', // DB Insurance

    // Technology & software
    'KRX.018260', // Samsung SDS
    'KRX.036570', // NCsoft
    'KRX.251270', // Netmarble
    'KRX.112610', // CSW
    'KRX.293490', // Kakao Games

    // Major KOSDAQ companies
    'KRX.034220', // LG Display
    'KRX.068270', // Celltrion
    'KRX.326030', // SK Biopharmaceuticals
    'KRX.207940', // Samsung Biologics
    'KRX.028300', // HLB
    'KRX.214320', // Seegene
    'KRX.196170', // Alteogen
    'KRX.302440', // SK Bioscience

    // Bio & pharma
    'KRX.128940', // Korea Yakult
    'KRX.141080', // Legochemicals
    'KRX.145020', // Huons
    'KRX.228760', // Jeil Pharmaceutical
    'KRX.130960', // CrystalGenomics
    'KRX.083650', // INOTherapeutics

    // Consumer goods
    'KRX.097950', // CJ CheilJedang
    'KRX.004020', // Hyundai Steel
    'KRX.090430', // Amorepacific
    'KRX.282330', // BGF Retail

    // Construction & real estate
    'KRX.028050', // Samsung Engineering
    'KRX.003410', // Samsung Heavy Industries
    'KRX.000720', // Hyundai Construction Equipment

    // Food & beverage
    'KRX.271560', // Orion
    'KRX.047050', // Posco Holdings
    'KRX.003230', // Samyang Holdings

    // Energy & utilities
    'KRX.010620', // Hyundai Heavy Industries Holdings
    'KRX.267250', // Hyundai Heavy Industries
    'KRX.003520', // Young Poong

    // Retail & distribution
    'KRX.023530', // Lotte Shopping
    'KRX.139480', // E-Mart
    'KRX.006260', // LS

    // Semiconductors & electronics
    'KRX.000990', // DB HiTek
    'KRX.042670', // HD Hyundai Infracore
    'KRX.307950', // Hyundai AutoEver

    // Additional coverage for better SEO
    'KRX.020560', // Asia Paper
    'KRX.004990', // Lotte Holdings
    'KRX.014680', // SK
    'KRX.001040', // CJ
    'KRX.079550', // LIG Nex1
    'KRX.071840', // Doosan Bobcat
    'KRX.138930', // BNK Financial Group
    'KRX.175330', // JB Financial Group
    'KRX.029780', // Samsung Card
    'KRX.032830', // Samsung Life Insurance

    // Small & mid cap with high growth potential
    'KRX.222800', // Simtech
    'KRX.058470', // GKL
    'KRX.067160', // Apsun
    'KRX.263750', // Pearlabyss
    'KRX.215600', // Shin Poong Pharmaceutical
    'KRX.230360', // HiFive
    'KRX.041510', // SM
    'KRX.122870', // YG Entertainment
    'KRX.035900', // JYP Entertainment
    'KRX.352820', // Hybe

    // Manufacturing
    'KRX.008770', // Hanwha Systems
    'KRX.272210', // Korea Shipbuilding
    'KRX.000150', // Doosan
    'KRX.001230', // Samyang Optics
    'KRX.004000', // Lotte Fine Chemical
];

// Pages configuration for different listing types
export const LISTING_PAGES_CONFIG = {
    marketcaps: { totalPages: 50, itemsPerPage: 20 }, // 1000 companies
    per: { totalPages: 30, itemsPerPage: 20 },        // 600 companies  
    pbr: { totalPages: 30, itemsPerPage: 20 },        // 600 companies
    eps: { totalPages: 25, itemsPerPage: 20 },        // 500 companies
    dps: { totalPages: 25, itemsPerPage: 20 },        // 500 companies
    div: { totalPages: 20, itemsPerPage: 20 },        // 400 companies
    bps: { totalPages: 25, itemsPerPage: 20 },        // 500 companies
};

/**
 * Get securities list for SSG builds
 * Uses static data if in build mode or database fails
 */
export function getSSGSecurityCodes(): string[] {
    return MAJOR_KOREAN_SECURITIES;
}

/**
 * Get company codes for SSG builds
 * Most securities have company data, so return the same list
 */
export function getSSGCompanyCodes(): string[] {
    return MAJOR_KOREAN_SECURITIES;
}

/**
 * Generate page numbers for a given listing type
 */
export function getSSGPageNumbers(listingType: keyof typeof LISTING_PAGES_CONFIG): number[] {
    const config = LISTING_PAGES_CONFIG[listingType];
    if (!config) return [1]; // fallback

    return Array.from({ length: config.totalPages }, (_, i) => i + 1);
}
