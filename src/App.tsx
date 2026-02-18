import { useState } from 'react'
import './App.css'

interface Stock
{
    symbol: string
    name: string
    shares: number
    avgPrice: number
    currentPrice: number
}

interface PortfolioHistory
{
    date: string
    value: number
}

type TimeRange = 'day' | 'week' | 'month'

function App()
{
    // 샘플 데이터 (실제로는 API에서 가져올 데이터)
    const [stocks] = useState<Stock[]>([
        {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            shares: 50,
            avgPrice: 150.25,
            currentPrice: 178.50
        },
        {
            symbol: 'MSFT',
            name: 'Microsoft Corporation',
            shares: 30,
            avgPrice: 320.80,
            currentPrice: 378.91
        },
        {
            symbol: 'GOOGL',
            name: 'Alphabet Inc.',
            shares: 20,
            avgPrice: 125.60,
            currentPrice: 141.80
        },
        {
            symbol: 'TSLA',
            name: 'Tesla, Inc.',
            shares: 25,
            avgPrice: 245.30,
            currentPrice: 238.45
        },
        {
            symbol: 'NVDA',
            name: 'NVIDIA Corporation',
            shares: 15,
            avgPrice: 450.00,
            currentPrice: 495.22
        }
    ])

    const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('month')

    const calculateReturn = (stock: Stock) =>
    {
        const profit = (stock.currentPrice - stock.avgPrice) * stock.shares
        const returnPercent = ((stock.currentPrice - stock.avgPrice) / stock.avgPrice) * 100

        return { profit, returnPercent }
    }

    const calculateTotalValue = () =>
    {
        return stocks.reduce((sum, stock) => sum + (stock.currentPrice * stock.shares), 0)
    }

    const calculateTotalInvested = () =>
    {
        return stocks.reduce((sum, stock) => sum + (stock.avgPrice * stock.shares), 0)
    }

    const calculateTotalProfit = () =>
    {
        return stocks.reduce((sum, stock) =>
        {
            const { profit } = calculateReturn(stock)

            return sum + profit
        }, 0)
    }

    const calculateTotalReturn = () =>
    {
        const invested = calculateTotalInvested()
        const profit = calculateTotalProfit()

        return (profit / invested) * 100
    }

    const totalValue = calculateTotalValue()
    const totalInvested = calculateTotalInvested()
    const totalProfit = calculateTotalProfit()
    const totalReturn = calculateTotalReturn()

    // 전체 히스토리 데이터 생성 (30일)
    const generateFullHistory = (): PortfolioHistory[] =>
    {
        const history: PortfolioHistory[] = []
        const today = new Date()
        const startValue = 25000
        const endValue = totalValue

        // 고정된 변동성 패턴 사용 (시드 기반)
        const volatilityPattern =
        [
            -300, 200, -150, 400, 100, -250, 350, -100, 450, 50,
            -200, 300, -350, 250, -50, 400, 150, -300, 200, -100,
            350, -150, 100, 300, -200, 250, -50, 150, 200, 100
        ]

        for (let i = 29; i >= 0; i--)
        {
            const date = new Date(today)
            date.setDate(date.getDate() - i)

            const progress = (29 - i) / 29
            const trend = startValue + (endValue - startValue) * progress
            const volatility = volatilityPattern[29 - i]
            const value = trend + volatility

            history.push({
                date: date.toISOString().split('T')[0],
                value: Math.max(value, startValue * 0.95)
            })
        }

        return history
    }

    const [fullHistory] = useState<PortfolioHistory[]>(generateFullHistory())

    // 선택된 기간에 따라 필터링된 히스토리 반환
    const getFilteredHistory = (): PortfolioHistory[] =>
    {
        const today = new Date()
        let daysToShow = 0

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

        const cutoffDate = new Date(today)
        cutoffDate.setDate(cutoffDate.getDate() - daysToShow)

        return fullHistory.filter(item => new Date(item.date) >= cutoffDate)
    }

    const portfolioHistory = getFilteredHistory()

    const formatCurrency = (value: number) =>
    {
        return new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(value)
    }

    const formatPercent = (value: number) =>
    {
        return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
    }

    // 차트 데이터 계산
    const maxValue = Math.max(...portfolioHistory.map(h => h.value))
    const minValue = Math.min(...portfolioHistory.map(h => h.value))
    const valueRange = maxValue - minValue
    const periodChange = portfolioHistory.length > 1
        ? ((portfolioHistory[portfolioHistory.length - 1].value - portfolioHistory[0].value) / portfolioHistory[0].value) * 100
        : 0

    // 시간대에 따른 날짜 포맷
    const formatDate = (dateString: string) =>
    {
        const date = new Date(dateString)

        switch (selectedTimeRange)
        {
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
    const getXAxisLabels = () =>
    {
        switch (selectedTimeRange)
        {
            case 'day':
                return portfolioHistory.filter((_, i) => i === 0 || i === portfolioHistory.length - 1)
            case 'week':
                return portfolioHistory.filter((_, i) => i % 2 === 0 || i === portfolioHistory.length - 1)
            case 'month':
                return portfolioHistory.filter((_, i) => i % 6 === 0 || i === portfolioHistory.length - 1)
            default:
                return portfolioHistory
        }
    }

    const getTimeRangeLabel = () =>
    {
        switch (selectedTimeRange) {
            case 'day':
                return '오늘'
            case 'week':
                return '지난 7일'
            case 'month':
                return '지난 30일'
        }
    }

    return(
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
                    <a href="#" className="nav-item active">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        <span>대시보드</span>
                    </a>

                    <a href="#" className="nav-item">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                        <span>포트폴리오</span>
                    </a>

                    <a href="#" className="nav-item">
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
                <div className="content-header">
                    <div>
                        <h1>포트폴리오</h1>
                        <p className="subtitle">AI가 관리하는 주식 현황</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn-secondary">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5l5-5 5 5m-5-5v12" />
                            </svg>
                            내보내기
                        </button>
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
                        <div className="summary-value">{formatCurrency(totalValue)}</div>
                    </div>

                    <div className="summary-card">
                        <div className="summary-label">투자 금액</div>
                        <div className="summary-value">{formatCurrency(totalInvested)}</div>
                    </div>

                    <div className="summary-card highlight">
                        <div className="summary-label">총 수익</div>
                        <div className={`summary-value ${totalProfit >= 0 ? 'positive' : 'negative'}`}>
                            {formatCurrency(totalProfit)}
                        </div>
                        <div className={`profit-amount ${totalReturn >= 0 ? 'positive' : 'negative'}`}>
                            {formatPercent(totalReturn)}
                        </div>
                    </div>
                </div>

                {/* 포트폴리오 가치 추이 차트 */}
                <div className="chart-section">
                    <div className="chart-header">
                        <div>
                            <h2 className="section-title">포트폴리오 가치 추이</h2>
                            <p className="chart-subtitle">{getTimeRangeLabel()}간의 총 보유 자산 변화</p>
                        </div>
                        <div className="chart-stats">
                            {/* 기간 선택 버튼 */}
                            <div className="time-range-buttons">
                                <button
                                    className={`time-range-btn ${selectedTimeRange === 'day' ? 'active' : ''}`}
                                    onClick={() => setSelectedTimeRange('day')}
                                >
                                    일
                                </button>
                                <button
                                    className={`time-range-btn ${selectedTimeRange === 'week' ? 'active' : ''}`}
                                    onClick={() => setSelectedTimeRange('week')}
                                >
                                    주
                                </button>
                                <button
                                    className={`time-range-btn ${selectedTimeRange === 'month' ? 'active' : ''}`}
                                    onClick={() => setSelectedTimeRange('month')}
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
                                <span>{formatPercent(periodChange)}</span>
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
                                        {formatCurrency(value)}
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
                    ${portfolioHistory.map((point, i) => {
                                        const x = (i / Math.max(portfolioHistory.length - 1, 1)) * 800
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
                                    d={portfolioHistory.map((point, i) => {
                                        const x = (i / Math.max(portfolioHistory.length - 1, 1)) * 800
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
                                {portfolioHistory.map((point, i) => {
                                    const showDot = selectedTimeRange === 'day'
                                        ? true
                                        : (i % 5 === 0 || i === portfolioHistory.length - 1)

                                    if (!showDot) return null

                                    const x = (i / Math.max(portfolioHistory.length - 1, 1)) * 800
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
                                {getXAxisLabels().map((point, i) => (
                                    <div key={i} className="chart-label">
                                        {formatDate(point.date)}
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
                                <span className="legend-stat-value">{formatCurrency(maxValue)}</span>
                            </div>
                            <div className="legend-stat">
                                <span className="legend-stat-label">최저</span>
                                <span className="legend-stat-value">{formatCurrency(minValue)}</span>
                            </div>
                            <div className="legend-stat">
                                <span className="legend-stat-label">현재</span>
                                <span className="legend-stat-value">{formatCurrency(portfolioHistory[portfolioHistory.length - 1].value)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 주식 목록 */}
                <div className="stocks-section">
                    <h2 className="section-title">보유 종목 ({stocks.length})</h2>

                    <div className="stocks-grid">
                        {stocks.map((stock) => {
                            const { profit, returnPercent } = calculateReturn(stock)
                            const totalValue = stock.currentPrice * stock.shares
                            const totalCost = stock.avgPrice * stock.shares

                            return (
                                <div key={stock.symbol} className="stock-card">
                                    <div className="stock-header">
                                        <div className="stock-symbol-area">
                                            <div className="stock-symbol">{stock.symbol}</div>
                                            <div className="stock-name">{stock.name}</div>
                                        </div>
                                        <div className={`return-badge ${returnPercent >= 0 ? 'positive' : 'negative'}`}>
                                            {formatPercent(returnPercent)}
                                        </div>
                                    </div>

                                    <div className="stock-details">
                                        <div className="detail-row">
                                            <span className="detail-label">보유 수량</span>
                                            <span className="detail-value">{stock.shares}주</span>
                                        </div>

                                        <div className="detail-row">
                                            <span className="detail-label">평균 단가</span>
                                            <span className="detail-value">{formatCurrency(stock.avgPrice)}</span>
                                        </div>

                                        <div className="detail-row">
                                            <span className="detail-label">현재가</span>
                                            <span className="detail-value">{formatCurrency(stock.currentPrice)}</span>
                                        </div>

                                        <div className="divider"></div>

                                        <div className="detail-row">
                                            <span className="detail-label">투자 금액</span>
                                            <span className="detail-value">{formatCurrency(totalCost)}</span>
                                        </div>

                                        <div className="detail-row">
                                            <span className="detail-label">평가 금액</span>
                                            <span className="detail-value">{formatCurrency(totalValue)}</span>
                                        </div>

                                        <div className="detail-row highlight">
                                            <span className="detail-label">손익</span>
                                            <span className={`detail-value ${profit >= 0 ? 'positive' : 'negative'}`}>
                                                {formatCurrency(profit)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </main>
        </div>
    )
}

export default App
