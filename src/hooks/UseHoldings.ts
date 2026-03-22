import { useEffect, useRef, useState } from 'react'

export interface Holding {
    account: string         // 계좌 번호
    code: string            // 종목 코드
    name: string            // 종목명
    quantity: number        // 보유 수량
    price: number           // 현재가
    value: number           // 평가 금액
    purchasePrice: number   // 매입 금액
    profitLoss: number      // 손익 금액
    profitRate: number      // 손익률 (매입가 대비)
    prevClosePrice: number  // 전일 종가
    dailyProfitRate: number // 하루 수익률 (전일 종가 대비)
}

export interface PortfolioSnapshot {
    date: string
    value: number
}

export interface TradeRecord {
    tradeDate: string           // 거래일자
    tradeNo: string            // 거래번호
    stockCode: string          // 종목코드
    stockName: string          // 종목명
    ioType: string             // 입출구분
    ioTypeName: string         // 입출구분명
    tradeQty: string           // 거래수량
    tradeAmt: string           // 거래금액
    exctAmt: string            // 정산금액
    commission: string         // 수수료
    taxFee: string             // 세금수수료합
    tradeUnit: string          // 거래단가
    procTime: string           // 처리시간
    creditDealTypeName: string // 신용거래구분명
    remarkName: string         // 적요명
}

export type ChartTimeRange = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month'

// 한국 주식시장 장 운영 시간 체크 (09:00 ~ 15:30)
function isMarketHours(date?: Date): boolean {
    const d = date ?? new Date()
    const totalMinutes = d.getHours() * 60 + d.getMinutes()
    return totalMinutes >= 540 && totalMinutes <= 930  // 09:00(540분) ~ 15:30(930분)
}

// timeRange에 해당하는 간격(밀리초)을 반환 (서버의 intervalSeconds와 동일 기준)
function getIntervalMs(range: ChartTimeRange): number {
    switch (range) {
        case 'second': return 5 * 1000        // 5초
        case 'minute': return 60 * 1000       // 1분
        case 'hour': return 600 * 1000      // 10분
        case 'day': return 3600 * 1000     // 1시간
        case 'week': return 21600 * 1000    // 6시간
        case 'month': return 86400 * 1000    // 1일
        default: return 3600 * 1000
    }
}

// timeRange에 해당하는 최대 데이터 개수 반환
function getMaxPoints(range: ChartTimeRange): number {
    switch (range) {
        case 'second': return 60;     // 5분 (5초 간격 = 60개)
        case 'minute': return 60;     // 1시간 (1분 간격 = 60개)
        case 'hour': return 144;      // 24시간 (10분 간격 = 144개)
        case 'day': return 168;       // 7일 (1시간 간격 = 168개)
        case 'week': return 120;      // 1개월 (6시간 간격 = 120개)
        case 'month': return 180;     // 6개월 (1일 간격 = 180개)
        default: return 500;
    }
}

export function UseHoldings(timeRange: ChartTimeRange = 'day') {
    const [holdingsMap, setHoldingsMap] = useState<Map<string, Holding>>(new Map())
    const [connected, setConnected] = useState(false)
    const [history, setHistory] = useState<PortfolioSnapshot[]>([])
    const [trades, setTrades] = useState<TradeRecord[]>([])
    const mapRef = useRef<Map<string, Holding>>(new Map())
    const esRef = useRef<EventSource | null>(null)
    const timeRangeRef = useRef<ChartTimeRange>(timeRange)

    // timeRange가 변경될 때 ref도 갱신 (SSE 콜백에서 최신 값 참조)
    useEffect(() => {
        timeRangeRef.current = timeRange
    }, [timeRange])

    useEffect(() => {
        // 초기 보유 종목 데이터 로드 (REST API)
        fetch('/stream/holdings/latest')
            .then(res => res.json())
            .then((data: Holding[]) => {
                const map = new Map<string, Holding>()
                data.forEach((h: Holding) => map.set(h.code, h))
                mapRef.current = map
                setHoldingsMap(new Map(map))
            })
            .catch((err: unknown) => console.warn('초기 보유 데이터 로드 실패:', err))

        // DB에서 포트폴리오 과거 기록 로드
        fetch(`/stream/portfolio/chart?range=${timeRange}`)
            .then(res => res.json())
            .then((data: { snapshotTime: string, totalValue: number }[]) => {
                if (data.length > 0) {
                    const dbHistory: PortfolioSnapshot[] = data.map(s => ({
                        date: s.snapshotTime,
                        value: s.totalValue,
                    }))
                    setHistory(dbHistory)
                } else {
                    setHistory([])
                }
            })
            .catch((err: unknown) => console.warn('포트폴리오 히스토리 로드 실패:', err))

        // 초기 거래 내역 로드 (메모리 캐시)
        fetch('/stream/trades/latest')
            .then(res => res.json())
            .then((data: TradeRecord[]) => {
                if (data.length > 0)
                    setTrades(data)
            })
            .catch((err: unknown) => console.warn('거래 내역 로드 실패:', err))

        // SSE 실시간 구독
        const es = new EventSource('/stream/holdings')
        esRef.current = es

        es.addEventListener('holding', (e: MessageEvent) => {
            try {
                const h: Holding = JSON.parse(e.data)
                const next = new Map(mapRef.current)
                next.set(h.code, h)
                mapRef.current = next

                setHoldingsMap(new Map(next))

                // SSE 콜백 내부에서 history 갱신 — 선택된 시간 간격을 존중
                const total = Array.from(next.values()).reduce((s: number, item: Holding) => s + item.value, 0)

                setHistory(prev => {
                    const last = prev[prev.length - 1]

                    if (last && last.value === total)
                        return prev

                    const now = new Date()

                    // 장 운영 시간(09:00~15:30) 외에는 차트 데이터 추가 안함
                    if (!isMarketHours(now))
                        return prev

                    const intervalMs = getIntervalMs(timeRangeRef.current)

                    // 마지막 데이터 포인트와의 시간 차이가 간격보다 작으면 값만 업데이트
                    if (last) {
                        const lastTime = new Date(last.date).getTime()
                        const elapsed = now.getTime() - lastTime

                        if (elapsed < intervalMs) {
                            const updated = [...prev]
                            updated[updated.length - 1] = { ...last, value: total }
                            return updated
                        }
                    }

                    // 간격 이상 경과: 새 포인트 추가
                    const entry: PortfolioSnapshot = { date: now.toISOString(), value: total }
                    const updated = [...prev, entry]

                    const maxPts = getMaxPoints(timeRangeRef.current)
                    return updated.length > maxPts ? updated.slice(-maxPts) : updated
                })
            }

            catch (err) {
                console.warn('holding 데이터 파싱 실패:', e.data, err)
            }
        })

        es.addEventListener('trade', (e: MessageEvent) => {
            try {
                const trade: TradeRecord = JSON.parse(e.data)

                setTrades(prev => {
                    // 중복 방지
                    const exists = prev.some(t =>
                        t.tradeDate === trade.tradeDate &&
                        t.tradeNo === trade.tradeNo &&
                        t.stockCode === trade.stockCode)

                    if (exists)
                        return prev

                    return [...prev, trade]
                })
            }

            catch (err) {
                console.warn('trade 데이터 파싱 실패:', e.data, err)
            }
        })

        es.onopen = () => setConnected(true)
        es.onerror = () => setConnected(false)

        return () => { es.close() }
    }, [timeRange])

    return {
        holdings: Array.from(holdingsMap.values()),
        history,
        trades,
        connected,
    }
}

