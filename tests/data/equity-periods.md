# 贵州茅台与泡泡玛特真实行情快照

用于 `tests/html/overlay/period-points.html` 的资产下拉选择。抓取于 2026-09-20，最新真实交易日为 2026-09-18；数据本地加载，不是实时订阅。未把模拟价格、插值或未来预测写入行情。

| 资产 | 文件 | 真实日线范围 | 可用周期及根数 |
| --- | --- | --- | --- |
| 贵州茅台 600519.SH | sh600519-periods.json | 2024-01-29 至 2026-09-18 | 5m 240、15m 80、30m 40、1h 20、1d 640、1w 135、1M 32 |
| 泡泡玛特 09992.HK | hk09992-periods.json | 2024-02-09 至 2026-09-18 | 1d 640、1w 136、1M 31 |

## 行情来源与转换

- [贵州茅台日线原始接口](https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,day,,,640,)
- [贵州茅台 5 分钟原始接口](https://ifzq.gtimg.cn/appstock/app/kline/mkline?param=sh600519,m5,,640)
- [泡泡玛特日线原始接口](https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=hk09992,day,,,640,)

腾讯财经响应的 `day` / `m5` 行依次读取时间、开、收、高、低、成交量，价格未复权。成交量原样保留供应商单位，不用于跨资产比较或凭空换算；不从附加字段猜测成交额。原始响应 SHA-256 保存在 sources 中，供快照追溯，不是供应商签发的校验值。

日线日期归一到当天交易所本地 09:30，转换为 UTC 毫秒。5 分钟数据的 09:35 等结束标记向前移 5 分钟，变成 09:30 等开始标记；取 2026-09-13 起的最近一周，实际有 9 月 14–18 日五个交易日。15m、30m、1h 使用首开、末收、最高、最低、成交量求和聚合，按 09:30 起累计有效交易分钟，跳过午休。

周线以周一至周日分组，月线以自然月分组，按相同 OHLCV 规则聚合日线，timestamp 为组内第一根真实日线的开始时间。舍弃数据窗口开头的第一个周/月组，避免部分历史组误作完整行情；当前周/月组可能尚未结束。聚合不是随机生成数据。

泡泡玛特分钟接口本次返回不可用结果，未补造分钟线；其分钟和小时选项在 UI 禁用。以后取得可信分钟快照再补充。

## 日历配置的来源与界限

- [上交所 2026 休市安排](https://www.sse.com.cn/disclosure/announcement/general/c/c_20251222_10802507.shtml)
- [港交所 2026 证券市场假日与半日市](https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/SEHK/2025/ce_SEHK_CT_075_2025.pdf)
- [港交所证券交易时段](https://www.hkex.com.hk/Services/Trading-hours-and-Severe-Weather-Arrangements/Trading-Hours/Securities-Market)

A 股常规时段为 09:30–11:30 / 13:00–15:00；港股为 09:30–12:00 / 13:00–16:00。港股半日市使用上午时段完整覆盖，日内推算未纳入集合竞价的随机结束时间；日线价格仍为供应商实际收盘价。

2026 年使用上述交易所公告的休市、半日市；历史数据窗口内缺少日线的工作日，在此 demo 的**资产日历**中按无 bar 日处理，可能包含停牌或供应商缺数据，不宣称是完整的官方历史交易日历。窗口之外尤其 2027 年以后仅按已配置周历推算，未虚构未来公告。
