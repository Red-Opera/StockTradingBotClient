import { useEffect, useRef, useState } from 'react'

export interface Holding
{
    account: string         // 계좌 번호
    code: string            // 종목 코드
    name: string            // 종목명
    quantity: number        // 보유 수량
    price: number           // 현재가
    value: number           // 평가 금액
    purchasePrice: number   // 매입 금액
    profitLoss: number      // 손익 금액
    profitRate: number      // 손익률
}

export interface PortfolioSnapshot
{
    date: string
    value: number
}

export function UseHoldings()
{
    const [holdingsMap, setHoldingsMap] = useState<Map<string, Holding>>(new Map())
    const [connected, setConnected] = useState(false)
    const [history, setHistory] = useState<PortfolioSnapshot[]>([])
    const mapRef = useRef<Map<string, Holding>>(new Map())
    const esRef = useRef<EventSource | null>(null)

    useEffect(() =>
    {
        // 초기 데이터 로드 (REST API)
        fetch('/stream/holdings/latest')
            .then(res => res.json())
            .then((data: Holding[]) =>
            {
                const map = new Map<string, Holding>()
                data.forEach((h: Holding) => map.set(h.code, h))
                mapRef.current = map
                setHoldingsMap(new Map(map))

                const total = data.reduce((s: number, h: Holding) => s + h.value, 0)

                if (total > 0)
                    setHistory([{ date: new Date().toISOString(), value: total }])
            })
            .catch((err: unknown) => console.warn('초기 보유 데이터 로드 실패:', err))

        // SSE 실시간 구독
        const es = new EventSource('/stream/holdings')
        esRef.current = es

        es.addEventListener('holding', (e: MessageEvent) =>
        {
            try
            {
                const h: Holding = JSON.parse(e.data)
                const next = new Map(mapRef.current)
                next.set(h.code, h)
                mapRef.current = next
                setHoldingsMap(new Map(next))

                // SSE 콜백 내부에서 history 갱신 (useEffect 동기 호출 아님)
                const total = Array.from(next.values()).reduce((s: number, item: Holding) => s + item.value, 0)

                setHistory(prev =>
                {
                    const last = prev[prev.length - 1]

                    if (last && last.value === total)
                        return prev

                    const entry: PortfolioSnapshot = { date: new Date().toISOString(), value: total }
                    const updated = [...prev, entry]

                    return updated.length > 500 ? updated.slice(-500) : updated
                })
            }

            catch (err)
            {
                console.warn('holding 데이터 파싱 실패:', e.data, err)
            }
        })

        es.onopen = () => setConnected(true)
        es.onerror = () => setConnected(false)

        return () =>
        {
            es.close()
        }
    }, [])

    return {
        holdings: Array.from(holdingsMap.values()),
        history,
        connected,
    }
}
