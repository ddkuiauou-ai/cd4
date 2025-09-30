// 보안 유틸리티 함수들

/**
 * 문자열을 sanitize하여 XSS 공격을 방지
 */
export function sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';
    // HTML 태그 제거 및 특수 문자 이스케이프
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * 스토리지에 저장할 데이터의 유효성 검증
 */
export function validateStorageData(data: any): boolean {
    // 저장할 데이터의 유효성 검증
    if (typeof data === 'boolean') return true;
    if (typeof data === 'string' && data.length < 1000) return true;
    if (Array.isArray(data) && data.length < 100) {
        return data.every(item =>
            typeof item === 'object' &&
            item !== null &&
            typeof item.name === 'string' &&
            typeof item.secCode === 'string'
        );
    }
    return false;
}

/**
 * 안전한 스토리지 저장 함수
 */
export function safeStorageSet(key: string, value: any, useSession = false): void {
    if (typeof window === 'undefined') return;

    if (!validateStorageData(value)) {
        console.warn(`Invalid data for storage key: ${key}`);
        return;
    }

    try {
        const storage = useSession ? sessionStorage : localStorage;
        storage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Storage operation failed:', error);
    }
}

/**
 * 안전한 스토리지 조회 함수
 */
export function safeStorageGet(key: string, useSession = false): any {
    if (typeof window === 'undefined') return null;

    try {
        const storage = useSession ? sessionStorage : localStorage;
        const item = storage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error('Storage retrieval failed:', error);
        return null;
    }
}

/**
 * HTML 콘텐츠를 안전하게 생성 (innerHTML 대안)
 */
export function createSafeHtmlElement(tag: string, content: string, attributes: Record<string, string> = {}): HTMLElement {
    const element = document.createElement(tag);

    // 콘텐츠 설정 (텍스트로 설정하여 XSS 방지)
    element.textContent = content;

    // 속성 설정
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else {
            element.setAttribute(key, sanitizeString(value));
        }
    });

    return element;
}
