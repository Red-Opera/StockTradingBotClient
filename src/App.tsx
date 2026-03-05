import { useState } from 'react'
import './App.css'
import { UseHoldings } from './hooks/UseHoldings'
import type { PortfolioSnapshot, TradeRecord } from './hooks/UseHoldings'

type TimeRange = 'day' | 'week' | 'month'
type PageType = 'dashboard' | 'trades'
type TradeFilterType = 'all' | 'buy' | 'sell'

function App() {
    const { holdings, history, trades, connected } = UseHoldings()
    const [selectedTimeRange, SetSelectedTimeRange] = useState<TimeRange>('month')
    const [activePage, SetActivePage] = useState<PageType>('dashboard')
    const [tradeFilter, SetTradeFilter] = useState<TradeFilterType>('all')

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
        if (timeStr.length < 6) return timeStr
        return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`
    }

    // 실시간 총 평가 금액
    const totalValue = holdings.reduce((sum: number, h) => sum + h.value, 0)
    const totalInvested = holdings.reduce((sum: number, h) => sum + h.purchasePrice * h.quantity, 0)
    const totalProfit = holdings.reduce((sum: number, h) => sum + h.profitLoss, 0)
    const totalReturn = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0

    // 선택된 기간에 따라 필터링된 히스토리 반환
    const GetFilteredHistory = (): PortfolioSnapshot[] => {
        const base = history.length > 0
            ? history
            : [{ date: new Date().toISOString(), value: totalValue }]

        const today = new Date()
        let daysToShow = 30

        // 기간에 따른 일 수 계산
        switch (selectedTimeRange) {
            case 'day':
                daysToShow = 1
                break

            case 'week':
                daysToShow = 7
                break

            case 'month':
                daysToShow = 30
                break
        }

        // 오늘 날짜에서 선택된 기간만큼 이전 날짜 계산
        const cutoffDate = new Date(today)
        cutoffDate.setDate(cutoffDate.getDate() - daysToShow)

        const filtered = base.filter(item => new Date(item.date) >= cutoffDate)

        return filtered.length > 0 ? filtered : base
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
            case 'day':
                return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

            case 'week':
                return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })

            case 'month':
                return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
            default:

                return dateString
        }
    }

    // X축 레이블 필터링
    const GetXAxisLabels = () => {
        switch (selectedTimeRange) {
            case 'day':
                return portfolioHistory_filtered.filter((_, i) => i === 0 || i === portfolioHistory_filtered.length - 1)

            case 'week':
                return portfolioHistory_filtered.filter((_, i) => i % 2 === 0 || i === portfolioHistory_filtered.length - 1)

            case 'month':
                return portfolioHistory_filtered.filter((_, i) => i % Math.max(Math.floor(portfolioHistory_filtered.length / 5), 1) === 0 || i === portfolioHistory_filtered.length - 1)

            default:
                return portfolioHistory_filtered
        }
    }

    const GetTimeRangeLabel = () => {
        switch (selectedTimeRange) {
            case 'day':
                return '오늘'

            case 'week':
                return '지난 7일'

            case 'month':
                return '지난 30일'
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
                                    <div className="time-range-buttons">
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

                                <div className="chart-wrapper">
                                    <svg className="chart" viewBox="0 0 800 200" preserveAspectRatio="none">
                                        {/* Grid lines */}
                                        <g className="grid-lines">
                                            {[0, 1, 2, 3, 4].map((i) => (
                                                <line
                                                    key={i}
                                                    x1="0"
                                                    y1={i * 50}
                                                    x2="800"
                                                    y2={i * 50}
                                                    stroke="#3f3f46"
                                                    strokeWidth="1"
                                                    strokeDasharray="4 4"
                                                />
                                            ))}
                                        </g>

                                        {/* Area fill */}
                                        <defs>
                                            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
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
                                            fill="none"
                                            stroke="#3b82f6"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />

                                        {/* Dots on data points */}
                                        {portfolioHistory_filtered.map((point, i) => {
                                            const showDot = selectedTimeRange === 'day'
                                                ? true
                                                : (i % 5 === 0 || i === portfolioHistory_filtered.length - 1)

                                            if (!showDot) return null

                                            const x = (i / Math.max(portfolioHistory_filtered.length - 1, 1)) * 800
                                            const normalizedValue = (point.value - minValue) / (valueRange || 1)
                                            const y = 200 - (normalizedValue * 200)
                                            return (
                                                <circle
                                                    key={i}
                                                    cx={x}
                                                    cy={y}
                                                    r="4"
                                                    fill="#3b82f6"
                                                    stroke="#141414"
                                                    strokeWidth="2"
                                                />
                                            )
                                        })}
                                    </svg>

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
