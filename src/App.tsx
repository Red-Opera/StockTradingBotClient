import { useState, useRef, useCallback } from 'react'
import './App.css'
import { UseHoldings } from './hooks/UseHoldings'
import type { ChartTimeRange, PortfolioSnapshot, TradeRecord } from './hooks/UseHoldings'

type PageType = 'dashboard' | 'trades'
type TradeFilterType = 'all' | 'buy' | 'sell'

function App() {
    const [selectedTimeRange, SetSelectedTimeRange] = useState<ChartTimeRange>('month')
    const { holdings, history, trades, connected } = UseHoldings(selectedTimeRange)
    const [activePage, SetActivePage] = useState<PageType>('dashboard')
    const [tradeFilter, SetTradeFilter] = useState<TradeFilterType>('all')
    const [hoveredIndex, SetHoveredIndex] = useState<number | null>(null)
    const chartWrapperRef = useRef<HTMLDivElement>(null)

    // 거래 내역 필터링
    const GetFilteredTrades = (): TradeRecord[] => {
        let filtered = [...trades]

        if (tradeFilter === 'buy')
            filtered = filtered.filter(t => t.ioTypeName.includes('매수'))
        else if (tradeFilter === 'sell')
            filtered = filtered.filter(t => t.ioTypeName.includes('매도'))

        // 최신순 정렬
        filtered.sort((a, b) => {
            const dateComp = b.tradeDate.localeCompare(a.tradeDate)
            if (dateComp !== 0) return dateComp
            return b.tradeNo.localeCompare(a.tradeNo)
        })

        return filtered
    }

    const filteredTrades = GetFilteredTrades()

    // 거래 금액 포맷팅 (패딩된 숫자 문자열에서 실수값으로 변환)
    const FormatTradeAmount = (value: string) => {
        const num = parseInt(value, 10)
        if (isNaN(num)) return value
        return new Intl.NumberFormat('ko-KR').format(num) + '원'
    }

    // 거래일자 포맷팅
    const FormatTradeDate = (dateStr: string) => {
        if (dateStr.length !== 8) return dateStr
        return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    }

    // 처리시간 포맷팅
    const FormatProcTime = (timeStr: string) => {
        if (!timeStr) return timeStr
        
        // 숫자만 추출 (불필요한 콜론과 다른 문자 제거)
        const digits = timeStr.replace(/\D/g, '')
        
        // 숫자가 없으면 원본 반환
        if (digits.length === 0) return timeStr
        
        // 6자리 미만이면 앞에 0을 패딩
        const padded = digits.padStart(6, '0')
        
        // HH:MM:SS 형식으로 변환
        return `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`
    }

    // 실시간 총 평가 금액
    const totalValue = holdings.reduce((sum: number, h) => sum + h.value, 0)
    const totalInvested = holdings.reduce((sum: number, h) => sum + h.purchasePrice * h.quantity, 0)
    const totalProfit = holdings.reduce((sum: number, h) => sum + h.profitLoss, 0)
    const totalReturn = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0

    // 선택된 기간에 따라 필터링된 히스토리 반환 - 백엔드에서 이미 처리해서 주므로 그대로 반환 (히스토리가 비었을때만 현재 가치 1개 리턴)
    const GetFilteredHistory = (): PortfolioSnapshot[] => {
        return history.length > 0
            ? history
            : [{ date: new Date().toISOString(), value: totalValue }]
    }

    const portfolioHistory_filtered = GetFilteredHistory()

    const FormatCurrency = (value: number) => {
        return new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: 'KRW',
            minimumFractionDigits: 0
        }).format(value)
    }

    const FormatPercent = (value: number) => {
        return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
    }

    // 차트 데이터 계산
    const maxValue = Math.max(...portfolioHistory_filtered.map(h => h.value), totalValue || 1)
    const minValue = Math.min(...portfolioHistory_filtered.map(h => h.value), totalValue || 0)
    const valueRange = maxValue - minValue || 1
    const periodChange = portfolioHistory_filtered.length > 1
        ? ((portfolioHistory_filtered[portfolioHistory_filtered.length - 1].value - portfolioHistory_filtered[0].value) / Math.abs(portfolioHistory_filtered[0].value || 1)) * 100
        : 0

    // 시간대에 따른 날짜 포맷
    const FormatDate = (dateString: string) => {
        const date = new Date(dateString)

        switch (selectedTimeRange) {
            case 'second':
            case 'minute':
                return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            case 'hour':
            case 'day':
                return date.toLocaleTimeString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            case 'week':
            case 'month':
                return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
            default:
                return dateString
        }
    }

    // 툴팁용 상세 날짜 포맷
    const FormatTooltipDate = (dateString: string) => {
        const date = new Date(dateString)
        const datePart = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
        const timePart = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        return { datePart, timePart }
    }

    // 차트 마우스 이벤트 핸들러
    const HandleChartMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const wrapper = chartWrapperRef.current
        if (!wrapper || portfolioHistory_filtered.length <= 1) return

        const rect = wrapper.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const chartWidth = rect.width
        const ratio = mouseX / chartWidth
        const index = Math.round(ratio * (portfolioHistory_filtered.length - 1))
        const clampedIndex = Math.max(0, Math.min(index, portfolioHistory_filtered.length - 1))

        SetHoveredIndex(clampedIndex)
    }, [portfolioHistory_filtered.length])

    const HandleChartMouseLeave = useCallback(() => {
        SetHoveredIndex(null)
    }, [])

    // X축 레이블 필터링
    const GetXAxisLabels = () => {
        const length = portfolioHistory_filtered.length;
        if (length <= 5) return portfolioHistory_filtered;

        // 약 5개의 레이블이 표시되도록 간격 계산
        const step = Math.max(Math.floor(length / 5), 1);

        return portfolioHistory_filtered.filter((_, i) => i % step === 0 || i === length - 1);
    }

    const GetTimeRangeLabel = () => {
        switch (selectedTimeRange) {
            case 'second':
                return '최근 5분'
            case 'minute':
                return '최근 1시간'
            case 'hour':
                return '최근 24시간'
            case 'day':
                return '지난 7일'
            case 'week':
                return '지난 1개월'
            case 'month':
                return '지난 6개월'
            default:
                return ''
        }
    }

    return (
        <div className="app">
            {/* 사이드 네비게이션 */}
            <nav className="sidebar">
                <div className="sidebar-header">
                    <div className="logo">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                            <rect width="32" height="32" rx="8" fill="#3b82f6" />
                            <path d="M8 20L14 14L18 18L24 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="24" cy="12" r="2" fill="white" />
                        </svg>
                    </div>
                    <h2>AI Trader</h2>
                </div>

                <div className="nav-items">
                    <a href="#" className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); SetActivePage('dashboard') }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        <span>대시보드</span>
                    </a>

                    <a href="#" className={`nav-item ${activePage === 'trades' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); SetActivePage('trades') }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="1" x2="12" y2="23" />
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        <span>거래 내역</span>
                    </a>

                    <a href="#" className="nav-item">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                            <line x1="12" y1="22.08" x2="12" y2="12" />
                        </svg>
                        <span>AI 전략</span>
                    </a>

                    <a href="#" className="nav-item">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 1v6m0 6v6m-8-8h6m6 0h6" />
                        </svg>
                        <span>설정</span>
                    </a>
                </div>
            </nav>

            {/* 메인 콘텐츠 */}
            <main className="main-content">
                {activePage === 'dashboard' && (
                    <>
                        <div className="content-header">
                            <div>
                                <h1>포트폴리오</h1>
                                <p className="subtitle">AI가 관리하는 주식 현황</p>
                            </div>
                            <div className="header-actions">
                                <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
                                    <span className="status-dot"></span>
                                    <span>{connected ? '실시간 연결됨' : '연결 끊김'}</span>
                                </div>
                                <button className="btn-primary">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="1 4 1 10 7 10" />
                                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                    </svg>
                                    새로고침
                                </button>
                            </div>
                        </div>

                        {/* 요약 카드 */}
                        <div className="summary-cards">
                            <div className="summary-card">
                                <div className="summary-label">총 자산 가치</div>
                                <div className="summary-value">{FormatCurrency(totalValue)}</div>
                            </div>

                            <div className="summary-card">
                                <div className="summary-label">투자 금액</div>
                                <div className="summary-value">{FormatCurrency(totalInvested)}</div>
                            </div>

                            <div className="summary-card highlight">
                                <div className="summary-label">총 수익</div>
                                <div className={`summary-value ${totalProfit >= 0 ? 'positive' : 'negative'}`}>
                                    {FormatCurrency(totalProfit)}
                                </div>
                                <div className={`profit-amount ${totalReturn >= 0 ? 'positive' : 'negative'}`}>
                                    {FormatPercent(totalReturn)}
                                </div>
                            </div>
                        </div>

                        {/* 포트폴리오 가치 추이 차트 */}
                        <div className="chart-section">
                            <div className="chart-header">
                                <div>
                                    <h2 className="section-title">포트폴리오 가치 추이</h2>
                                    <p className="chart-subtitle">{GetTimeRangeLabel()}간의 총 보유 자산 변화</p>
                                </div>
                                <div className="chart-stats">
                                    {/* 기간 선택 버튼 */}
                                    <div className="time-range-buttons" style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
                                        <button
                                            className={`time-range-btn ${selectedTimeRange === 'second' ? 'active' : ''}`}
                                            onClick={() => SetSelectedTimeRange('second')}
                                        >
                                            초
                                        </button>
                                        <button
                                            className={`time-range-btn ${selectedTimeRange === 'minute' ? 'active' : ''}`}
                                            onClick={() => SetSelectedTimeRange('minute')}
                                        >
                                            분
                                        </button>
                                        <button
                                            className={`time-range-btn ${selectedTimeRange === 'hour' ? 'active' : ''}`}
                                            onClick={() => SetSelectedTimeRange('hour')}
                                        >
                                            시
                                        </button>
                                        <button
                                            className={`time-range-btn ${selectedTimeRange === 'day' ? 'active' : ''}`}
                                            onClick={() => SetSelectedTimeRange('day')}
                                        >
                                            일
                                        </button>
                                        <button
                                            className={`time-range-btn ${selectedTimeRange === 'week' ? 'active' : ''}`}
                                            onClick={() => SetSelectedTimeRange('week')}
                                        >
                                            주
                                        </button>
                                        <button
                                            className={`time-range-btn ${selectedTimeRange === 'month' ? 'active' : ''}`}
                                            onClick={() => SetSelectedTimeRange('month')}
                                        >
                                            월
                                        </button>
                                    </div>

                                    <div className={`chart-change ${periodChange >= 0 ? 'positive' : 'negative'}`}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            {periodChange >= 0 ? (
                                                <polyline points="18 15 12 9 6 15" />
                                            ) : (
                                                <polyline points="6 9 12 15 18 9" />
                                            )}
                                        </svg>
                                        <span>{FormatPercent(periodChange)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="chart-container">
                                {/* Y-axis labels */}
                                <div className="chart-y-labels">
                                    {[0, 1, 2, 3, 4].map((i) => {
                                        const value = maxValue - (i * valueRange / 4)
                                        return (
                                            <div key={i} className="chart-y-label">
                                                {FormatCurrency(value)}
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="chart-main">
                                    <div
                                        className="chart-wrapper"
                                        ref={chartWrapperRef}
                                        onMouseMove={HandleChartMouseMove}
                                        onMouseLeave={HandleChartMouseLeave}
                                    >
                                        {/* Area and Line SVG (Stretched) */}
                                        <svg
                                            className="chart"
                                            viewBox="0 0 800 200"
                                            preserveAspectRatio="none"
                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                                        >
                                            {/* Area fill */}
                                            <defs>
                                                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                    <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.42" />
                                                    <stop offset="55%" stopColor="#2563eb" stopOpacity="0.18" />
                                                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                                                </linearGradient>
                                                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                    <stop offset="0%" stopColor="#7dd3fc" />
                                                    <stop offset="45%" stopColor="#60a5fa" />
                                                    <stop offset="100%" stopColor="#3b82f6" />
                                                </linearGradient>
                                            </defs>

                                            <path
                                                d={`
                    M 0 200
                    ${portfolioHistory_filtered.map((point, i) => {
                                                    const x = (i / Math.max(portfolioHistory_filtered.length - 1, 1)) * 800
                                                    const normalizedValue = (point.value - minValue) / (valueRange || 1)
                                                    const y = 200 - (normalizedValue * 200)
                                                    return `L ${x} ${y}`
                                                }).join(' ')}
                    L 800 200
                    Z
                  `}
                                                fill="url(#areaGradient)"
                                            />

                                            {/* Line */}
                                            <path
                                                d={portfolioHistory_filtered.map((point, i) => {
                                                    const x = (i / Math.max(portfolioHistory_filtered.length - 1, 1)) * 800
                                                    const normalizedValue = (point.value - minValue) / (valueRange || 1)
                                                    const y = 200 - (normalizedValue * 200)
                                                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                                                }).join(' ')}
                                                className="chart-line-main"
                                                fill="none"
                                                stroke="url(#lineGradient)"
                                                strokeWidth="2.8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>

                                        {/* Grid, Dots, and Indicators SVG (Not Stretched) */}
                                        <svg
                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                                        >
                                            {/* Grid lines */}
                                            <g className="grid-lines">
                                                {[0, 1, 2, 3, 4].map((i) => (
                                                    <line
                                                        key={i}
                                                        x1="0"
                                                        y1={`${i * 25}%`}
                                                        x2="100%"
                                                        y2={`${i * 25}%`}
                                                        stroke="#3f3f46"
                                                        strokeWidth="1"
                                                        strokeDasharray="4 4"
                                                    />
                                                ))}
                                            </g>

                                            {/* Vertical indicator line */}
                                            {hoveredIndex !== null && (() => {
                                                const xPercent = (hoveredIndex / Math.max(portfolioHistory_filtered.length - 1, 1)) * 100
                                                return (
                                                    <line
                                                        x1={`${xPercent}%`}
                                                        y1="0"
                                                        x2={`${xPercent}%`}
                                                        y2="100%"
                                                        stroke="#3b82f6"
                                                        strokeWidth="1.5"
                                                        strokeOpacity="0.7"
                                                        className="chart-vertical-line"
                                                    />
                                                )
                                            })()}

                                            {/* Dots on data points */}
                                            {portfolioHistory_filtered.map((point, i) => {
                                                const isHovered = hoveredIndex === i

                                                const xPercent = (i / Math.max(portfolioHistory_filtered.length - 1, 1)) * 100
                                                const normalizedValue = (point.value - minValue) / (valueRange || 1)
                                                const yPercent = (1 - normalizedValue) * 100

                                                return (
                                                    <g key={i}>
                                                        {isHovered && (
                                                            <circle
                                                                cx={`${xPercent}%`}
                                                                cy={`${yPercent}%`}
                                                                r="10"
                                                                fill="#3b82f6"
                                                                fillOpacity="0.2"
                                                                className="chart-active-dot-glow"
                                                            />
                                                        )}
                                                        <circle
                                                            cx={`${xPercent}%`}
                                                            cy={`${yPercent}%`}
                                                            r={isHovered ? 6 : 4}
                                                            fill={isHovered ? '#60a5fa' : '#3b82f6'}
                                                            stroke={isHovered ? '#ffffff' : '#141414'}
                                                            strokeWidth={isHovered ? 2.5 : 2}
                                                            className={isHovered ? 'chart-active-dot' : ''}
                                                        />
                                                    </g>
                                                )
                                            })}
                                        </svg>

                                        {/* Tooltip */}
                                        {hoveredIndex !== null && portfolioHistory_filtered[hoveredIndex] && (() => {
                                            const point = portfolioHistory_filtered[hoveredIndex]
                                            const { datePart, timePart } = FormatTooltipDate(point.date)
                                            const firstValue = portfolioHistory_filtered[0].value
                                            const changeFromStart = firstValue !== 0
                                                ? ((point.value - firstValue) / Math.abs(firstValue)) * 100
                                                : 0
                                            const prevPoint = hoveredIndex > 0 ? portfolioHistory_filtered[hoveredIndex - 1] : null
                                            const changeFromPrev = prevPoint ? point.value - prevPoint.value : 0

                                            // 툴팁 위치 계산 (퍼센트 기반)
                                            const xPercent = (hoveredIndex / Math.max(portfolioHistory_filtered.length - 1, 1)) * 100
                                            const tooltipStyle: React.CSSProperties = {
                                                left: `${xPercent}%`,
                                                transform: xPercent > 70 ? 'translateX(-100%)' : xPercent < 30 ? 'translateX(0)' : 'translateX(-50%)',
                                            }

                                            return (
                                                <div className="chart-tooltip" style={tooltipStyle}>
                                                    <div className="chart-tooltip-header">
                                                        <span className="chart-tooltip-date">{datePart}</span>
                                                        <span className="chart-tooltip-time">{timePart}</span>
                                                    </div>
                                                    <div className="chart-tooltip-body">
                                                        <div className="chart-tooltip-row">
                                                            <span className="chart-tooltip-label">총 자산</span>
                                                            <span className="chart-tooltip-value">{FormatCurrency(point.value)}</span>
                                                        </div>
                                                        <div className="chart-tooltip-row">
                                                            <span className="chart-tooltip-label">기간 대비</span>
                                                            <span className={`chart-tooltip-value ${changeFromStart >= 0 ? 'positive' : 'negative'}`}>
                                                                {FormatPercent(changeFromStart)}
                                                            </span>
                                                        </div>
                                                        {prevPoint && (
                                                            <div className="chart-tooltip-row">
                                                                <span className="chart-tooltip-label">이전 대비</span>
                                                                <span className={`chart-tooltip-value ${changeFromPrev >= 0 ? 'positive' : 'negative'}`}>
                                                                    {changeFromPrev >= 0 ? '+' : ''}{FormatCurrency(changeFromPrev)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                    </div>

                                    {/* X-axis labels */}
                                    <div className="chart-labels">
                                        {GetXAxisLabels().map((point, i) => (
                                            <div key={i} className="chart-label">
                                                {FormatDate(point.date)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Chart legend */}
                            <div className="chart-legend">
                                <div className="legend-item">
                                    <div className="legend-color" style={{ background: '#3b82f6' }}></div>
                                    <span>총 자산 가치</span>
                                </div>
                                <div className="legend-values">
                                    <div className="legend-stat">
                                        <span className="legend-stat-label">최고</span>
                                        <span className="legend-stat-value">{FormatCurrency(maxValue)}</span>
                                    </div>
                                    <div className="legend-stat">
                                        <span className="legend-stat-label">최저</span>
                                        <span className="legend-stat-value">{FormatCurrency(minValue)}</span>
                                    </div>
                                    <div className="legend-stat">
                                        <span className="legend-stat-label">현재</span>
                                        <span className="legend-stat-value">{FormatCurrency(portfolioHistory_filtered.length > 0 ? portfolioHistory_filtered[portfolioHistory_filtered.length - 1].value : totalValue)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 보유 종목 목록 */}
                        <div className="stocks-section">
                            <h2 className="section-title">보유 종목 ({holdings.length})</h2>

                            <div className="stocks-grid">
                                {holdings.length === 0 ? (
                                    <div className="empty-state">
                                        <p>{connected ? '수신된 종목 데이터가 없습니다.' : 'C++ 서버 연결 대기 중...'}</p>
                                    </div>
                                ) : (
                                    holdings.map((h) => {
                                        const avgUnitPrice = h.purchasePrice

                                        return (
                                            <div key={h.code} className="stock-card">
                                                <div className="stock-header">
                                                    <div className="stock-symbol-area">
                                                        <div className="stock-symbol">{h.code}</div>
                                                        <div className="stock-name">{h.name}</div>
                                                    </div>
                                                    <div className={`return-badge ${h.profitRate >= 0 ? 'positive' : 'negative'}`}>
                                                        {FormatPercent(h.profitRate)}
                                                    </div>
                                                </div>

                                                <div className="stock-details">
                                                    <div className="detail-row">
                                                        <span className="detail-label">보유 수량</span>
                                                        <span className="detail-value">{h.quantity.toLocaleString('ko-KR')}주</span>
                                                    </div>

                                                    <div className="detail-row">
                                                        <span className="detail-label">평균 단가</span>
                                                        <span className="detail-value">{FormatCurrency(avgUnitPrice)}</span>
                                                    </div>

                                                    <div className="detail-row">
                                                        <span className="detail-label">현재가</span>
                                                        <span className="detail-value">{FormatCurrency(h.price)}</span>
                                                    </div>

                                                    <div className="divider"></div>

                                                    <div className="detail-row">
                                                        <span className="detail-label">매입 금액</span>
                                                        <span className="detail-value">{FormatCurrency(h.purchasePrice * h.quantity)}</span>
                                                    </div>

                                                    <div className="detail-row">
                                                        <span className="detail-label">평가 금액</span>
                                                        <span className="detail-value">{FormatCurrency(h.value)}</span>
                                                    </div>

                                                    <div className="detail-row highlight">
                                                        <span className="detail-label">손익</span>
                                                        <span className={`detail-value ${h.profitLoss >= 0 ? 'positive' : 'negative'}`}>
                                                            {FormatCurrency(h.profitLoss)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </>)}

                {activePage === 'trades' && (
                    <>
                        <div className="content-header">
                            <div>
                                <h1>거래 내역</h1>
                                <p className="subtitle">위탁종합거래내역 조회</p>
                            </div>
                            <div className="header-actions">
                                <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
                                    <span className="status-dot"></span>
                                    <span>{connected ? '실시간 연결됨' : '연결 끊김'}</span>
                                </div>
                            </div>
                        </div>

                        {/* 거래 요약 카드 */}
                        <div className="summary-cards">
                            <div className="summary-card">
                                <div className="summary-label">총 거래 건수</div>
                                <div className="summary-value">{trades.length}건</div>
                            </div>
                            <div className="summary-card">
                                <div className="summary-label">매수 건수</div>
                                <div className="summary-value positive">
                                    {trades.filter(t => t.ioTypeName.includes('매수')).length}건
                                </div>
                            </div>
                            <div className="summary-card">
                                <div className="summary-label">매도 건수</div>
                                <div className="summary-value negative">
                                    {trades.filter(t => t.ioTypeName.includes('매도')).length}건
                                </div>
                            </div>
                        </div>

                        {/* 거래 내역 테이블 */}
                        <div className="trades-section">
                            <div className="trades-header">
                                <h2 className="section-title">거래 목록</h2>
                                <div className="trade-filter-buttons">
                                    <button
                                        className={`trade-filter-btn ${tradeFilter === 'all' ? 'active' : ''}`}
                                        onClick={() => SetTradeFilter('all')}
                                    >전체</button>
                                    <button
                                        className={`trade-filter-btn ${tradeFilter === 'buy' ? 'active' : ''}`}
                                        onClick={() => SetTradeFilter('buy')}
                                    >매수</button>
                                    <button
                                        className={`trade-filter-btn ${tradeFilter === 'sell' ? 'active' : ''}`}
                                        onClick={() => SetTradeFilter('sell')}
                                    >매도</button>
                                </div>
                            </div>

                            {filteredTrades.length === 0 ? (
                                <div className="empty-state">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}>
                                        <line x1="12" y1="1" x2="12" y2="23" />
                                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                    </svg>
                                    <p>{connected ? '수신된 거래 내역이 없습니다.' : 'C++ 서버 연결 대기 중...'}</p>
                                </div>
                            ) : (
                                <div className="trades-table-container">
                                    <table className="trades-table">
                                        <thead>
                                            <tr>
                                                <th>거래일</th>
                                                <th>시간</th>
                                                <th>종목</th>
                                                <th>구분</th>
                                                <th>수량</th>
                                                <th>단가</th>
                                                <th>거래금액</th>
                                                <th>수수료</th>
                                                <th>세금</th>
                                                <th>정산금액</th>
                                                <th>적요</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTrades.map((t, idx) => (
                                                <tr key={`${t.tradeDate}-${t.tradeNo}-${t.stockCode}-${idx}`}>
                                                    <td>{FormatTradeDate(t.tradeDate)}</td>
                                                    <td>{FormatProcTime(t.procTime)}</td>
                                                    <td>
                                                        <div className="trade-stock-info">
                                                            <span className="trade-stock-name">{t.stockName}</span>
                                                            <span className="trade-stock-code">{t.stockCode}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`trade-type-badge ${t.ioTypeName.includes('매수') ? 'buy' : t.ioTypeName.includes('매도') ? 'sell' : ''}`}>
                                                            {t.ioTypeName}
                                                        </span>
                                                    </td>
                                                    <td className="text-right">{t.tradeQty}</td>
                                                    <td className="text-right">{t.tradeUnit}</td>
                                                    <td className="text-right">{FormatTradeAmount(t.tradeAmt)}</td>
                                                    <td className="text-right">{FormatTradeAmount(t.commission)}</td>
                                                    <td className="text-right">{FormatTradeAmount(t.taxFee)}</td>
                                                    <td className="text-right">{FormatTradeAmount(t.exctAmt)}</td>
                                                    <td className="trade-remark">{t.remarkName}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>)}
            </main>
        </div>
    )
}

export default App
