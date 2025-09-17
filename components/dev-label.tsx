/*
█████████████████████████████████████████████████████████████████████████████████████████████████████
██ DEV-LABEL: Development Visual Label Component                                                    ██
██                                                                                                 ██
██ 목적: 개발 환경에서만 화면에 표시되는 시각적 라벨 컴포넌트                                        ██
██ 특징: NODE_ENV=development일 때만 렌더링, 작은 검은 라벨                                         ██
██ 사용처: 모든 컴포넌트에 쉽게 시각적 디버깅 라벨 추가                                             ██
█████████████████████████████████████████████████████████████████████████████████████████████████████
*/

interface DevLabelProps {
    label: string;
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    className?: string;
}

export function DevLabel({
    label,
    position = "top-left",
    className = ""
}: DevLabelProps) {
    // 개발 환경이 아니면 렌더링하지 않음
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    const positionClasses = {
        "top-left": "top-0 left-0 rounded-br",
        "top-right": "top-0 right-0 rounded-bl",
        "bottom-left": "bottom-0 left-0 rounded-tr",
        "bottom-right": "bottom-0 right-0 rounded-tl"
    };

    return (
        <div
            className={`absolute z-50 bg-black text-white text-xs px-2 py-1 font-mono pointer-events-none ${positionClasses[position]} ${className}`}
            style={{ fontSize: '10px' }}
        >
            {label}
        </div>
    );
}

export default DevLabel;
