# 指标实现公式与对比指南

本文把 `src/extension/indicator` 的实际计算逻辑转写为数学公式，供逐柱复算及与其他平台的公式对比使用。覆盖注册入口中的全部 **38 个指标**，包括分时和自定义指标；TD 状态机另见 [TD 指标算法详解](indicator-td-algorithms.md)。

源码基线：`2b98feddb`，整理日期：2026-10-14。公式以可执行代码为准；代码与注释不一致时明确列出。本文不把某个指标名称视为统一标准，也不据此宣称与某家平台兼容。对比要点中的其他公式是待核对的候选口径，不代表已验证某平台采用该口径。

## 阅读顺序

1. 先看“数学记号与计算口径”，避免把不同初始化方式当成同一个 EMA。
2. 通过“指标索引”找到默认参数、输出字段和首值位置。
3. 按各指标的公式、边界条件复算；优先核查“差异重点”。
4. 用末尾的手算样例和对比记录模板，逐项记录外部平台的不同之处。

## 数学记号与计算口径

### 数据与下标

数组下标从 **0** 开始，当前柱为 $t$。例如首值在 $t=N-1$，表示需要 $N$ 根柱；首值在 $t=N$，表示需要 $N+1$ 根柱。周期单位是输入柱数，不必然是交易日。

| 符号 | 源码字段及含义 |
| --- | --- |
| $O_t,H_t,L_t,C_t$ | `open, high, low, close`，开、高、低、收 |
| $V_t,A_t$ | `volume, turnover`，成交量、成交额 |
| $P_t=(H_t+L_t)/2$ | 高低中点价 |
| $T_t=(H_t+L_t+C_t)/3$ | 典型价格 |
| $\mathbf1[Q]$ | 条件 $Q$ 成立取 1，否则取 0 |
| $x^+=\max(x,0)$ | 只保留正值 |

一般公式假设 OHLC 为有限且有效的数据，周期为合法正整数。除专门说明的校验外，不能把这些数学前提理解为源码已校验所有参数。输入接口见 [KLineData](../src/common/KLineData.ts)。

### 滚动求和与均值

$$
S_N(x)_t=\sum_{j=t-N+1}^{t}x_j,\qquad
MA_N(x)_t=\frac{S_N(x)_t}{N}
$$

窗口包括当前柱。若 $x$ 从 $t=s$ 才有定义，则 $MA_N(x)$ 的首值在 $s+N-1$，不以 0 填充缺失历史。

$$
HH_N(t)=\max_{t-N+1\le j\le t}H_j,\qquad
LL_N(t)=\min_{t-N+1\le j\le t}L_j
$$

共用函数 [calcHhvLlv](../src/extension/indicator/utils.ts) 用单调队列计算上述极值，只在完整窗口出现后写值；算法优化不改变窗口定义。

### 三种必须区分的平滑方式

**均值初始化的 EMA**，记作 $E_N(x)$。若输入从 $s$ 开始：

$$
E_N(x)_{s+N-1}=\frac1N\sum_{j=s}^{s+N-1}x_j
$$
$$
E_N(x)_t=\frac{2}{N+1}x_t+\frac{N-1}{N+1}E_N(x)_{t-1}
\quad(t>s+N-1)
$$

**首值初始化的 EMA**，记作 $\widehat E_N(x)$：

$$
\widehat E_N(x)_s=x_s,\qquad
\widehat E_N(x)_t=\frac{2}{N+1}x_t+\frac{N-1}{N+1}\widehat E_N(x)_{t-1}
$$

二者递推相同，但种子和首值位置不同。本仓库独立 `EMA`、`MACD`、`TRIX` 使用前者，`PBX`、`ATR_CHANNELS` 内部 EMA 使用后者。

**Wilder 平滑**，记作 $R_N(x)$：

$$
R_N(x)_{s+N-1}=MA_N(x)_{s+N-1},\qquad
R_N(x)_t=\frac{x_t+(N-1)R_N(x)_{t-1}}{N}
$$

其新值权重是 $1/N$，而 EMA 是 $2/(N+1)$。`ATR`、`RSI` 使用此形式；`DMI` 的平滑和与它只差一个固定倍数。

### 首柱和缺失值

需要“前收盘价”且代码采用当前柱回退时，记 $C_{-1}=C_0$；`BRAR`、`ATR`、`DMI`、`VR`、`PSY` 等均有这种边界处理。`ASI`、`EMV` 则跳过首柱；`RSI` 从首个真实涨跌差 $t=1$ 开始累计。

大部分指标预热期返回 `{}`，或只返回已准备好的字段。**缺字段、数值 0、`NaN` 和 `Infinity` 必须分别比较。** `precision` 是显示配置，以下计算没有按该位数逐步四舍五入。

普通数值指标直接按传入数组顺序计算，不自行排序、补缺柱、复权、换算量额单位或按交易日重置。除 TD 系列外，这些 `calc` 不根据 `isClosed` 排除最后一柱。

## 指标索引

下表的首值位置适用于默认参数及有限的正常输入。多个参数的指标按顺序对应字段。TD 项给出引擎的最早计数位置，实际显示有额外过滤。

| 指标 | 默认参数 | 输出字段 | 默认首值下标 |
| --- | --- | --- | --- |
| MA | 5,10,30,60 | `ma1…ma4` | 4,9,29,59 |
| EMA | 6,12,20 | `ema1…ema3` | 5,11,19 |
| SMA | 12,2 | `sma` | 11 |
| BBI | 3,6,12,24 | `bbi` | 23 |
| PBX | 4,6,9,13,18,24 | `pbx1…pbx6` | 15,23,35,51,71,95 |
| BOLL | 20,2 | `up,mid,dn` | 19 |
| ATR | 14 | `atr` | 13 |
| ATR_CHANNELS | 26,13 | `ema,ema2,ema50,ema200`；`plus1Atr…plus3Atr,minus1Atr…minus3Atr` | EMA 均为 0；轨道为 25 |
| MIKE | 12 | `wr,mr,sr,ws,ms,ss` | 11 |
| SAR | 2,2,20 | `sar` | 0 |
| MACD | 12,26,9 | `dif`；`dea,macd` | 25；33 |
| DMA | 10,50,10 | `dif`；`difma` | 49；58 |
| AO | 5,34 | `ao` | 33 |
| BIAS | 6,12,24 | `bias1…bias3` | 5,11,23 |
| CCI | 14 | `cci` | 13 |
| KDJ | 9,3,3 | `k,d,j` | 8 |
| RSI | 6,12,24 | `rsi1…rsi3` | 6,12,24 |
| WR | 6,10,14 | `wr1…wr3` | 5,9,13 |
| MTM | 12,6 | `mtm`；`maMtm` | 12；17 |
| ROC | 12,6 | `roc`；`maRoc` | 11；16 |
| TRIX | 12,9 | `trix`；`maTrix` | 33；41 |
| DMI | 14,6 | `pdi,mdi`；`adx`；`adxr` | 13；26；31 |
| BRAR | 26 | `br,ar` | 25 |
| CR | 26,10,20,40,60 | `cr`；`ma1…ma4` | 25；39,53,81,109 |
| PSY | 12,6 | `psy`；`maPsy` | 11；16 |
| ASI | 26,10 | `asi`；`asit` | 26；35 |
| EMV | 14,9 | `emv`；`maEmv` | 1；14 |
| VOL | 5,10,20 | `volume`；`ma1…ma3` | 0；4,9,19 |
| VR | 26,6 | `vr`；`maVr` | 25；30 |
| OBV | 30 | `obv`；`maObv` | 0；29 |
| PVT | 无 | `pvt` | 0 |
| AVP | 无 | `avp` | 累计成交量首次非 0 时 |
| WA_PRICE | 无 | `waPrice` | 0 |
| VOL_MINUTE | 无 | `volume` | 0 |
| OPEN_INTEREST | 无 | `openInterest` | 0 |
| TD9 | 配置对象 | `setupMark` 等 | 默认最早 4，完成 9 最早 12 |
| td9_timeshare | 同 TD9 | 同 TD9 | 同 TD9 |
| TDSEQ | 配置对象 | Setup、Countdown、TDST、事件等 | 默认 Setup 最早 4，完成 9 最早 12 |

注册名称以 [index.ts](../src/extension/indicator/index.ts) 为准，尤其 `td9_timeshare` 的大小写和 `TDSEQ` 的名称。

## 均线与价格通道

### MA 简单移动平均

[源码 movingAverage.ts](../src/extension/indicator/movingAverage.ts)。每个参数 $N$ 对应一条 `ma` 线：

$$MA_t=MA_N(C)_t,\qquad t\ge N-1$$

直观含义是最近 $N$ 个收盘价等权平均。周期 $N\le0$ 时该线每柱返回 `NaN`。比较外部平台时确认价格源是否为收盘价、是否允许不足 $N$ 根时使用短窗口。

### EMA 指数移动平均

[源码 exponentialMovingAverage.ts](../src/extension/indicator/exponentialMovingAverage.ts)。每个参数 $N$ 输出 $E_N(C)$，首值在 $N-1$，种子为前 $N$ 个收盘价均值。$N\le0$ 返回 `NaN`。

近期价格权重更大，但不是从第一柱开始输出。即使外部公式也写作 `EMA(C,N)`，仍需检查种子是否为 $C_0$。

### SMA 源码中的平滑均线

[源码 simpleMovingAverage.ts](../src/extension/indicator/simpleMovingAverage.ts)。默认 $(N,M)=(12,2)$：

$$
Y_{N-1}=MA_N(C)_{N-1},\qquad
Y_t=\frac{MC_t+(N-M+1)Y_{t-1}}{N+1}
$$

因此权重 $\alpha=M/(N+1)$。它与简单均值 $MA_N$、权重为 $M/N$ 的递推、权重为 $1/N$ 的平滑都应分开对比。特别地，$M=2$ 时与相同周期的本仓库 `EMA` 一致。源码虽有 `SMMA` 注释及待修正 TODO，当前公式应按上式记录。

### BBI 多空指标

[源码 bullAndBearIndex.ts](../src/extension/indicator/bullAndBearIndex.ts)。设传入 $K$ 个周期 $N_1,\ldots,N_K$：

$$BBI_t=\frac14\sum_{r=1}^{K}MA_{N_r}(C)_t,\qquad t\ge\max_rN_r-1$$

默认是四条均线的平均。**分母固定为 4**，不是参数个数；若改成三条或五条，结果不再是这些均线的算术平均。

### PBX 瀑布线

[源码 pbx.ts](../src/extension/indicator/pbx.ts)。对每个周期 $N$：

$$PBX_{N,t}=\frac{\widehat E_N(C)_t+MA_{2N}(C)_t+MA_{4N}(C)_t}{3},\qquad t\ge4N-1$$

它把一个指数均线和两个更长的等权均线平均。内部 EMA 从 $C_0$ 初始化，因此不能直接把本仓库独立 `EMA` 的输出代入。$N\le0$ 返回 `NaN`。

### BOLL 布林带

[源码 bollingerBands.ts](../src/extension/indicator/bollingerBands.ts)。默认 $(N,k)=(20,2)$：

$$
MID_t=MA_N(C)_t,\qquad
\sigma_t=\sqrt{\max\left(\frac1N\sum_{j=t-N+1}^{t}C_j^2-MID_t^2,0\right)}
$$
$$UP_t=MID_t+k\sigma_t,\qquad DN_t=MID_t-k\sigma_t$$

三条线从 $N-1$ 输出。标准差分母为 **$N$**，不是 $N-1$；源码用平方和减均值平方，并将浮点误差导致的负方差截为 0。省略倍数时回退为 2。对比还应记录中轨均线类型和标准差的价格源。

### ATR 平均真实波幅

[源码 averageTrueRange.ts](../src/extension/indicator/averageTrueRange.ts)：

$$TR_t=\max(H_t-L_t,|H_t-C_{t-1}|,|L_t-C_{t-1}|)$$
$$ATR_t=R_N(TR)_t$$

首柱令 $C_{-1}=C_0$；正常 OHLC 下 $TR_0=H_0-L_0$。首值在 $N-1$，包含首柱的 TR。ATR 衡量振幅，量纲与价格相同。非正整数周期每柱返回 `{atr: NaN}`。比较时区分 Wilder 平滑、简单平均、EMA，以及是否丢弃首柱 TR。

### ATR_CHANNELS 多重 ATR 通道

[源码 atrChannels.ts](../src/extension/indicator/atrChannels.ts)。默认 $(N,M)=(26,13)$：

$$
ema_t=\widehat E_N(C)_t,\quad ema2_t=\widehat E_M(C)_t,\quad
ema50_t=\widehat E_{50}(C)_t,\quad ema200_t=\widehat E_{200}(C)_t
$$
$$plus{k}Atr_t=ema_t+kR_N(TR)_t,\quad minus{k}Atr_t=ema_t-kR_N(TR)_t,\quad k=1,2,3$$

四条 EMA 从首柱输出，六条轨道从 $N-1$ 输出。第二参数只控制 `ema2`；它不控制 ATR 周期，也不构成另一组轨道。`ema200` 默认隐藏，但仍计算。

若 $N$ 非正整数，中心 `ema` 和六条轨道均为 `NaN`；若 $M$ 非正整数，仅 `ema2` 为 `NaN`；固定的 50、200 EMA 仍计算。对比时确认中轨价格源、EMA 种子、ATR 平滑，以及 ATR 周期是否与中轨绑定。

### MIKE 支撑压力线

[源码 mike.ts](../src/extension/indicator/mike.ts)。令 $h=HH_N(t),l=LL_N(t),p=T_t$：

$$
WR=2p-l,\quad MR=p+h-l,\quad SR=2h-l
$$
$$
WS=2p-h,\quad MS=p-h+l,\quad SS=2l-h
$$

六条线从 $N-1$ 输出。这里 `wr` 是 MIKE 的弱压力线，不是独立 `WR` 振荡指标。典型价使用**当前柱**的 $H,L,C$；不是窗口典型价均值。强压力、强支撑直接使用窗口极值，不额外平滑。

### SAR 抛物线转向

[源码 stopAndReverse.ts](../src/extension/indicator/stopAndReverse.ts)。参数不是周期，而是以百分数传入的初始加速因子、步长、上限：

$$a_0=p_1/100,\quad d=p_2/100,\quad a_{max}=p_3/100$$

默认分别为 $0.02,0.02,0.20$。状态初始为：下跌方向、$SAR_{-1}=0$、$AF=a_0$、$EP=-100$（未初始化哨兵）。每柱严格按下面顺序计算：

| 步骤 | 上涨状态 | 下跌状态 |
| --- | --- | --- |
| 更新极值 | 若 EP 为哨兵或 $H_t>EP$，令 $EP=H_t$、$AF=\min(AF+d,a_{max})$ | 若 EP 为哨兵或 $L_t<EP$，令 $EP=L_t$、同样增加 AF |
| 计算候选值 | $S=SAR_{t-1}+AF(EP-SAR_{t-1})$ | 同左 |
| 检查反转 | 若 $S>L_t$：输出 $SAR_t=EP$，转下跌，$AF=a_0,EP=-100$ | 若 $S<H_t$：输出 $SAR_t=EP$，转上涨，$AF=0,EP=-100$ |
| 未反转时约束 | $SAR_t=\min(S,L_{t-1},L_t)$ | $SAR_t=\max(S,H_{t-1},H_t)$ |

首柱的前高、前低取自身。所有柱均输出。对比时特别检查：极值和 AF 在候选值**之前**更新；约束使用当前柱与前一柱；两种反转后的 AF 重置不对称；价格恰为 `-100` 会与哨兵混同。这些都不能仅用一条 SAR 递推式描述。

## 趋势差值与振荡指标

### MACD 指数均线差

[源码 movingAverageConvergenceDivergence.ts](../src/extension/indicator/movingAverageConvergenceDivergence.ts)。默认 $(S,L,M)=(12,26,9)$：

$$DIF_t=E_S(C)_t-E_L(C)_t,\qquad DEA_t=E_M(DIF)_t$$
$$MACD_t=2(DIF_t-DEA_t)$$

令 $Q=\max(S,L)$，DIF 首值在 $Q-1$；DEA 和柱状值在 $Q+M-2$。DEA 的种子为首 $M$ 个有效 DIF 的均值。**柱状值含倍数 2**；源码注释只说差值，复算必须采用实际乘 2 的代码。

### DMA 简单均线差

[源码 differentOfMovingAverage.ts](../src/extension/indicator/differentOfMovingAverage.ts)：

$$DIF_t=MA_{N_1}(C)_t-MA_{N_2}(C)_t,\qquad DIFMA_t=MA_M(DIF)_t$$

DIF 从 $\max(N_1,N_2)-1$ 输出，DIFMA 从 $\max(N_1,N_2)+M-2$ 输出。它与 MACD 的关键差别是两层均采用简单均值；这里的 `DMA` 不是可变权重动态均线。

### AO 动量柱

[源码 awesomeOscillator.ts](../src/extension/indicator/awesomeOscillator.ts)：

$$AO_t=MA_S(P)_t-MA_L(P)_t,\quad P_t=(H_t+L_t)/2$$

从 $\max(S,L)-1$ 输出。输入是高低中点价，不是收盘价；柱子颜色按本柱 AO 相比前柱是否增加决定，不按正负决定。

### BIAS 乖离率

[源码 bias.ts](../src/extension/indicator/bias.ts)。每个参数 $N$：

$$BIAS_{N,t}=100\frac{C_t-MA_N(C)_t}{MA_N(C)_t},\qquad t\ge N-1$$

表示收盘价相对均价的百分比偏离。$N\le0$ 返回 `NaN`；均价为 0 没有保护，可能得到 `NaN` 或无穷值。

### CCI 顺势指标

[源码 commodityChannelIndex.ts](../src/extension/indicator/commodityChannelIndex.ts)：

$$\mu_t=MA_N(T)_t,\qquad MD_t=\frac1N\sum_{j=t-N+1}^{t}|T_j-\mu_t|$$
$$CCI_t=\begin{cases}(T_t-\mu_t)/(0.015MD_t),&MD_t\ne0\\0,&MD_t=0\end{cases}$$

从 $N-1$ 输出。$MD$ 是相对于**当前窗口同一个均值**的平均绝对偏差，不是标准差，也不是 $MA_N(|T_j-MA_N(T)_j|)$。

### KDJ 随机指标

[源码 kdj.ts](../src/extension/indicator/kdj.ts)。默认 $(N,A,B)=(9,3,3)$：

$$r_t=HH_N(t)-LL_N(t),\qquad RSV_t=100\frac{C_t-LL_N(t)}{\begin{cases}r_t,&r_t\ne0\\1,&r_t=0\end{cases}}$$
$$K_t=\frac{(A-1)K_{t-1}+RSV_t}{A},\qquad D_t=\frac{(B-1)D_{t-1}+K_t}{B},\qquad J_t=3K_t-2D_t$$

三条线从 $N-1$ 输出，计算首值时前 K、D 均取 50。D 使用本柱新 K。正常平价窗口下 RSV 为 0，K、D 会向 0 衰减；不是沿用上次 RSV 或输出 50。J 未截断到 0～100。

### RSI 相对强弱指标

[源码 relativeStrengthIndex.ts](../src/extension/indicator/relativeStrengthIndex.ts)。对每个 $N$，从 $t=1$ 定义：

$$\Delta_t=C_t-C_{t-1},\quad G_t=\max(\Delta_t,0),\quad D_t=\max(-\Delta_t,0)$$
$$g_t=R_N(G)_t,\quad d_t=R_N(D)_t,\qquad RSI_t=\begin{cases}100g_t/(g_t+d_t),&g_t+d_t\ne0\\100,&g_t+d_t=0\end{cases}$$

首次平均使用 $\Delta_1,\ldots,\Delta_N$，因此首值在 **$N$**，需要 $N+1$ 根价格柱。全程不涨不跌时输出 **100**。$N\le0$ 返回 `NaN`。比较时检查是否使用滚动均值代替递推平滑，以及平价区间的定义。

### WR 威廉指标

[源码 williamsR.ts](../src/extension/indicator/williamsR.ts)：

$$WR_{N,t}=\begin{cases}100(C_t-HH_N(t))/(HH_N(t)-LL_N(t)),&HH_N(t)\ne LL_N(t)\\0,&\text{否则}\end{cases}$$

首值 $N-1$。正常 OHLC 下取值在 **$[-100,0]$**，最高处为 0，最低处为 -100。若对方使用 $100(HH-C)/(HH-LL)$，恰为反号。$N\le0$ 返回 `NaN`。

### MTM 动量

[源码 momentum.ts](../src/extension/indicator/momentum.ts)：

$$MTM_t=C_t-C_{t-N},\quad t\ge N;\qquad MAMTM_t=MA_M(MTM)_t$$

均线首值在 $N+M-1$。MTM 是价格绝对差，没有除以历史价格，也没有乘 100。

### ROC 变动率

[源码 rateOfChange.ts](../src/extension/indicator/rateOfChange.ts)。代码从 $N-1$ 开始：

$$B_t=\begin{cases}C_0,&t=N-1\\C_{t-N},&t\ge N\end{cases},\qquad ROC_t=\begin{cases}100(C_t-B_t)/B_t,&B_t\ne0\\0,&B_t=0\end{cases}$$
$$MAROC_t=MA_M(ROC)_t,\qquad t\ge N+M-2$$

**首个 ROC 只跨 $N-1$ 个间隔**，以后跨 $N$ 个间隔；首个短间隔值也进入 MAROC。对方若严格等到 $t=N$，不只起点不同，前几个 MAROC 也不同。

### TRIX 三重指数平滑变动率

[源码 tripleExponentiallySmoothedAverage.ts](../src/extension/indicator/tripleExponentiallySmoothedAverage.ts)：

$$E^{(1)}=E_N(C),\quad E^{(2)}=E_N(E^{(1)}),\quad E^{(3)}=E_N(E^{(2)})$$

三层首值分别在 $N-1,2N-2,3N-3$；每层均以首 $N$ 个有效输入的均值初始化。令 $s=3N-3$：

$$TRIX_s=0,\qquad TRIX_t=100\frac{E^{(3)}_t-E^{(3)}_{t-1}}{E^{(3)}_{t-1}}\quad(t>s)$$
$$MATRIX_t=MA_M(TRIX)_t,\qquad t\ge3N+M-4$$

首个 TRIX 的 0 是人为种子，并参与均线。后续分母为 0 没有保护。对比时核查是否延后一柱才输出真实变化率，以及三层 EMA 的种子。

### DMI 方向运动指标

[源码 directionalMovementIndex.ts](../src/extension/indicator/directionalMovementIndex.ts)。默认 $(N,M)=(14,6)$。设：

$$u_t=H_t-H_{t-1},\quad v_t=L_{t-1}-L_t$$
$$DM^+_t=\begin{cases}u_t,&u_t>0\land u_t>v_t\\0,&\text{否则}\end{cases},\quad DM^-_t=\begin{cases}v_t,&v_t>0\land v_t>u_t\\0,&\text{否则}\end{cases}$$

首柱以前高、前低取自身，因此两个 DM 都为 0。对 $x=TR,DM^+,DM^-$ 分别计算平滑和：

$$W_N(x)_{N-1}=\sum_{j=0}^{N-1}x_j,\qquad W_N(x)_t=(1-1/N)W_N(x)_{t-1}+x_t$$
$$PDI_t=100\frac{W_N(DM^+)_t}{W_N(TR)_t},\qquad MDI_t=100\frac{W_N(DM^-)_t}{W_N(TR)_t}$$

若 TR 平滑和为 0，两者均为 0。随后：

$$DX_t=\begin{cases}100|MDI_t-PDI_t|/(MDI_t+PDI_t),&MDI_t+PDI_t\ne0\\0,&\text{否则}\end{cases}$$
$$ADX_t=R_N(DX)_t,\qquad ADXR_t=\frac{ADX_t+ADX_{t-(M-1)}}2$$

PDI、MDI 从 $N-1$ 输出，ADX 从 $2N-2$ 输出，ADXR 从 $2N+M-3$ 输出。**ADX 使用第一参数 $N$ 平滑；第二参数 $M$ 控制 ADXR 的 $M-1$ 柱回看。** 源码注释中的 `EXPMEMA(DX,MM)`、`EXPMEMA(ADX,MM)` 不等于当前代码。

## 价格强弱与摆动指标

### BRAR 情绪指标

[源码 brar.ts](../src/extension/indicator/brar.ts)：

$$AR_t=100\frac{\sum_{j=t-N+1}^{t}(H_j-O_j)}{\sum_{j=t-N+1}^{t}(O_j-L_j)},\qquad BR_t=100\frac{\sum_{j=t-N+1}^{t}(H_j-C_{j-1})}{\sum_{j=t-N+1}^{t}(C_{j-1}-L_j)}$$

全局首柱取 $C_{-1}=C_0$。首值均在 $N-1$，分母为 0 时相应线输出 0。

AR 比较开盘价上下方的振幅，BR 比较前收盘价上下方的振幅。**BR 两个差值不截断到 0**，跳空时可能有负贡献；若外部公式使用 `MAX(...,0)`，就不是同一算法。

### CR 带状能量线

[源码 currentRatio.ts](../src/extension/indicator/currentRatio.ts)。默认 $N=26$，均线周期 $M_r\in\{10,20,40,60\}$。首柱以前中点价取自身：

$$U_t=\max(H_t-P_{t-1},0),\qquad D_t=\max(P_{t-1}-L_t,0)$$
$$CR_t=\begin{cases}100S_N(U)_t/S_N(D)_t,&S_N(D)_t\ne0\\0,&\text{否则}\end{cases}$$

CR 从 $N-1$ 输出。四条均线为：

$$q_r=\left\lceil M_r/2.5+1\right\rceil,\qquad MA{r}_t=MA_{M_r}(CR)_{t-q_r}$$

首值在 $N+M_r-2+q_r$。源码计算 $t$ 柱均值后将结果写到 $t+q_r$，等价于在显示位置引用过去均值，**不是读取未来价格**。超出输入长度的位置不输出。比较时核对前中点价是否用 $(H+L)/2$、偏移是否向上取整，以及位移方向。

### PSY 心理线

[源码 psychologicalLine.ts](../src/extension/indicator/psychologicalLine.ts)：

$$u_0=0,\quad u_t=\mathbf1[C_t>C_{t-1}],\qquad PSY_t=\frac{100}{N}S_N(u)_t$$
$$MAPSY_t=MA_M(PSY)_t$$

PSY 从 $N-1$ 输出，均线从 $N+M-2$ 输出。平盘计 0；首个窗口包含人为定义的 $u_0=0$，并不是 $N$ 个真实价格差。因此第一窗口即使一路上涨，最大也只有 $100(N-1)/N$。

### ASI 振动升降指标

[源码 accumulativeSwingIndex.ts](../src/extension/indicator/accumulativeSwingIndex.ts)。默认 $(M,N)=(26,10)$。从 $t=1$ 开始：

$$
a_t=|H_t-C_{t-1}|,\quad b_t=|L_t-C_{t-1}|,\quad
c_t=|H_t-L_{t-1}|,\quad d_t=|C_{t-1}-O_{t-1}|
$$
$$X_t=(C_t-C_{t-1})+\tfrac12(C_t-O_t)+(C_{t-1}-O_{t-1}),\qquad K_t=\max(a_t,b_t)$$
$$R_t=\begin{cases}a_t+b_t/2+d_t/4,&a_t>b_t\land a_t>c_t\\b_t+a_t/2+d_t/4,&b_t>a_t\land b_t>c_t\\c_t+d_t/4,&\text{否则}\end{cases}$$
$$SI_t=\begin{cases}16X_tK_t/R_t,&R_t\ne0\\0,&R_t=0\end{cases}$$
$$ASI_t=S_M(SI)_t,\qquad ASIT_t=MA_N(ASI)_t$$

首柱无输出；ASI 首值在 $M$，ASIT 在 $M+N-1$。ASI 是 **$M$ 柱滚动和**，不是从历史起点累计到当前的永久累加；没有额外涨跌停幅度参数。$R$ 的分支使用严格大于，相等时可能进入第三分支，不能按“取最大项”简写掉相等规则。

## 成交量与价量指标

### EMV 简易波动

[源码 easeOfMovementValue.ts](../src/extension/indicator/easeOfMovementValue.ts)。默认参数为 `[14,9]`，但**只使用第一个参数 $N=14$**。从 $t=1$：

$$EMV_t=\begin{cases}10^8\dfrac{(P_t-P_{t-1})(H_t-L_t)}{V_t},&V_t\ne0\land H_t\ne L_t\\0,&\text{否则}\end{cases}$$
$$MAEMV_t=MA_N(EMV)_t,\qquad t\ge N$$

缺失成交量按 0。`emv` 输出每柱原始波动值，从 $t=1$ 开始；`maEmv` 才是 $N$ 柱均值。它不按注释所说先做 $N$ 柱累和，也不使用第二参数做二次均线；除数是成交量，不是成交额。量的单位和 $10^8$ 缩放必须一起对齐。

### VOL 成交量及均线

[源码 volume.ts](../src/extension/indicator/volume.ts)：

$$volume_t=V_t,\qquad ma{r}_t=MA_{N_r}(V)_t$$

缺失成交量按 0，原始量从首柱输出，均线从 $N_r-1$ 输出。非正周期对应均线为 `NaN`。没有手数、股数或合约乘数换算。柱色按 $C_t$ 与 $O_t$ 比较，和均线公式无关。

### VR 成交量比率

[源码 volumeRatio.ts](../src/extension/indicator/volumeRatio.ts)。设首柱前收盘取自身，定义：

$$U_t=V_t\mathbf1[C_t>C_{t-1}],\quad D_t=V_t\mathbf1[C_t<C_{t-1}],\quad F_t=V_t\mathbf1[C_t=C_{t-1}]$$
$$VR_t=100\frac{S_N(U)_t+\tfrac12S_N(F)_t}{S_N(D)_t+\tfrac12S_N(F)_t},\qquad MAVR_t=MA_M(VR)_t$$

VR 从 $N-1$ 输出，均线从 $N+M-2$ 输出。缺失量按 0，分母为 0 时 VR 返回 0。首柱量归到平盘量 $F$；每个涨跌分类都相对于该柱的前收盘，而不是开盘价。源码含乘 100，不能直接与未乘 100 的比值比较。

### OBV 能量潮

[源码 onBalanceVolume.ts](../src/extension/indicator/onBalanceVolume.ts)：

$$OBV_0=0,\qquad OBV_t=OBV_{t-1}+\operatorname{sgn}(C_t-C_{t-1})V_t$$
$$MAOBV_t=MA_N(OBV)_t,\qquad t\ge N-1$$

缺失量按 0，平盘不增不减。初值为 0，首柱成交量不计入。若对方用 $V_0$ 初始化，原始 OBV 和后续均线可能相差一个常数；比较前须对齐历史起点。

### PVT 价量趋势的当前实现

[源码 priceAndVolumeTrend.ts](../src/extension/indicator/priceAndVolumeTrend.ts)。这里特意用 $V_t^*$ 区别其缺失值规则：

$$V_t^*=\begin{cases}V_t,&\text{字段非 null 且非 undefined}\\1,&\text{否则}\end{cases}$$
$$x_t=\begin{cases}\dfrac{C_t-C_{t-1}}{C_{t-1}V_t^*},&C_{t-1}V_t^*\ne0\\0,&\text{否则}\end{cases},\qquad PVT_t=\sum_{j=0}^{t}x_j$$

首柱前收盘取自身，正常输入下 $PVT_0=0$，每柱输出。

**代码实际把成交量放在分母**，与本文件注释中的下式不同：

$$x_t^{\text{注释}}=\frac{C_t-C_{t-1}}{C_{t-1}}V_t$$

对于非零成交量，两者增量比为 $x_t/x_t^{\text{注释}}=1/V_t^2$。这不是常量缩放造成的误差；成交量越大，当前实现的绝对增量反而越小。缺失量按 1、显式 0 量增量为 0，也要分别核对。

### AVP 累计量额均价

[源码 averagePrice.ts](../src/extension/indicator/averagePrice.ts)：

$$AVP_t=\frac{\sum_{j=0}^{t}A_j}{\sum_{j=0}^{t}V_j}$$

缺失成交额或成交量按 0。累计量为 0 时不写 `avp` 字段；否则直接输出累计额除累计量，不自行用 OHLC 推算成交额。若只有量而缺少额，可能输出 0。

累计范围是**整个传入数组**，跨交易日也不自动重置。结果单位等于成交额单位除以成交量单位；需在数据层对齐元／万元、股／手、张／合约等约定。

## 分时与自定义字段

这三个指标主要承担数据映射，没有价格推导、累计或平滑过程。

| 注册名 | 源码 | 公式和缺失值 |
| --- | --- | --- |
| WA_PRICE | [waPrice.ts](../src/extension/indicator/timeshare/waPrice.ts) | `waPrice = bar.waPrice ?? 0` |
| VOL_MINUTE | [volumeMinute.ts](../src/extension/indicator/timeshare/volumeMinute.ts) | `volume = bar.volume ?? 0` |
| OPEN_INTEREST | [openInterest.ts](../src/extension/indicator/custom/openInterest.ts) | `openInterest = bar.openInterest ?? 0` |

`WA_PRICE` 的均价算法取决于上游提供的 `waPrice`，这里无法由 OHLCV 推出。`VOL_MINUTE` 不把累计成交量转换为分钟增量，柱色使用 `diffLastPrice` 的正负。`OPEN_INTEREST` 不计算持仓变化量。

`td9_timeshare` 是第四个需注意的分时相关指标：它复用 TD9 的计算，仅将显示改为价格线着色和数字 9 标记，详见 [TD 文档](indicator-td-algorithms.md)。

## 差异重点

以下是从源码即可确定、应在跨平台对比表中优先填写的项目；这里只记录现状，不修改算法。

| 指标 | 当前实现 | 对比时需核对的另一种口径 |
| --- | --- | --- |
| PVT | 涨跌幅除以成交量 | 注释中的涨跌幅乘以成交量 |
| EMV | 原始 EMV 加 $N$ 柱均值，第二参数无效 | 先累和／平滑、再按第二参数平滑 |
| SMA | $\alpha=M/(N+1)$ | 简单均值、$M/N$ 递推、$1/N$ 递推 |
| DMI | ADX 用 $N$ 平滑；ADXR 引用 $M-1$ 柱前 ADX | 注释中的按 $M$ 平滑或其他回看距离 |
| EMA 与 PBX、ATR_CHANNELS | 两种不同的 EMA 种子 | 同一个函数名是否共用同一种种子 |
| MACD | 柱状值 $2(DIF-DEA)$ | 柱状值 $DIF-DEA$ |
| ROC | $t=N-1$ 提前输出一个短间隔值 | 从 $t=N$ 开始计算 |
| TRIX | 第三层首值时输出 0，进入均线 | 等待第三层的下一柱后才输出 |
| BOLL | 总体标准差，除以 $N$ | 样本标准差，除以 $N-1$ |
| RSI | $N$ 个真实差值初始化；全平价为 100 | 首柱补零进入平均、平价为 0 或 50 |
| WR | -100～0 | 0～100 的反号口径 |
| BRAR | BR 差值可为负 | 对高减前收、前收减低分别取正部 |
| CR | 均线延后 $\lceil M/2.5+1\rceil$ 柱 | 不偏移、取整方式或偏移方向不同 |
| ASI | SI 的滚动 $M$ 柱和 | 全历史累计、不同 SI 系数或限幅参数 |
| SAR | 初始下跌；反转时 AF 分别重置为 0 和初值 | 不同初始趋势、极值顺序和限位窗口 |
| BBI | 分母固定 4 | 按实际周期数量求平均 |
| AVP | 整段累计额／量 | 每交易日重置或按典型价加权 |
| TD 系列 | 有内部状态和显示过滤两层结果 | 仅以截图上可见数字判定计数是否一致 |

### 参数与异常输入的实际边界

- `MA/EMA/BIAS/PBX/RSI/VOL/WR` 显式处理周期 $\le0$，但未统一检查是否为整数、是否有限。
- `ATR` 和 `ATR_CHANNELS` 对其可变周期显式要求正整数；TD 系列有专门配置校验。
- 其他公式章节的首值和窗口描述基于正常周期；不能推断所有自定义参数都安全。例如 `DMA` 的平滑周期、`MTM/ROC/TRIX/VR/PSY` 的第二周期或 `OBV` 的周期设为 1 时，当前代码会在本柱写入结果数组之前读取该位置的字段，触发异常；该参数不能简单按数学上的 $MA_1(x)=x$ 使用。
- `?? 0` 只替换 `null/undefined`，不会替换 `NaN`；滚动累加中的 `NaN` 可能持续污染后续结果。`PVT` 对缺失量使用 `?? 1`，与其他量指标不同。
- `BIAS`、`TRIX` 的零分母没有统一处理，其他指标则可能返回 0、100 或缺字段。比较工具应保留这些区别，不能一概填 0。

## 可手算的对比样例

### 均线种子和 SMA 权重

给定 $C=[1,2,3,4]$、$N=3$。省略项表示尚未输出：

| 形式 | $t=0$ | $t=1$ | $t=2$ | $t=3$ |
| --- | --- | --- | --- | --- |
| $MA_3(C)$ | — | — | 2 | 3 |
| 本仓库独立 $E_3(C)$ | — | — | 2 | 3 |
| 首值种子 $\widehat E_3(C)$ | 1 | 1.5 | 2.25 | 3.125 |
| 本仓库 `SMA(3,1)` | — | — | 2 | 2.5 |

前三个相同参数名称并不能保证相同首值。本仓库 `SMA(3,1)` 的最后一步为 $(4+3\times2)/4=2.5$。

### PVT 的量在分子还是分母

两柱收盘价为 $[100,110]$，第二柱成交量为 10：

$$\Delta PVT_{\text{当前}}=\frac{110-100}{100\times10}=0.01$$
$$\Delta PVT_{\text{注释}}=\frac{110-100}{100}\times10=1$$

若第二柱成交量改为 100，当前增量变为 0.001，注释公式则变为 10。

### ROC 的第一段窗口

设 $C=[10,20,30,40]$、$N=3,M=2$。$t=2$ 已输出 ROC，基数取 $C_0$，值为 200；$t=3$ 仍取 $C_0$，值为 300；此时 MAROC 为 $(200+300)/2=250$。

### 平价窗口并不统一输出中性值

设所有柱 $O=H=L=C=100$，数据长度足够：

| 指标 | 输出 |
| --- | --- |
| RSI | 100 |
| WR、CCI、ATR | 0 |
| KDJ(9,3,3) 首值 | $K=100/3$，$D=400/9$，$J=100/9$ |
| BOLL | 三条线均为 100 |
| PSY | 0 |
| OBV、PVT | 0 |

KDJ 首值来自 RSV=0 和前 K、D=50；它没有直接输出 50。

## 跨平台对比方法

先对齐输入，再对齐公式。相同名称与参数不足以证明同算法。

1. **固定原始序列**：逐柱导出时间、OHLC、量、额；核对复权、时区、交易时段、缺柱、量额单位以及最后一柱是否收盘。
2. **固定历史起点**：递推平滑、累计指标和状态机依赖历史；仅截取显示区间再算，可能与带完整历史的图表不同。
3. **固定参数含义**：例如 SAR 三个参数都是百分数，DMI 第二参数不用于 ADX 平滑，EMV 第二参数没有效果。
4. **先比第一个有效值**：记录 0 起始下标、初始化窗口、种子、空值规则，再比递推。若首值错位，先修正对齐再比较数值。
5. **记录误差位置和形状**：固定倍数可检查 MACD、WR、量单位；随时间衰减的误差可检查 EMA 种子；仅早期不同可检查 ROC、TRIX；事件时间不同则核对 TD 规则和执行顺序。这些是定位线索，不是单凭形状即可下结论。
6. **比较未格式化数值**：可设 $|x-y|\le\varepsilon_{abs}+\varepsilon_{rel}\max(|x|,|y|)$；阈值应按价格和量的尺度约定。缺字段、非有限数、状态和事件单独比较。

### 对比记录模板

| 项目 | 本仓库 | 待对比平台 |
| --- | --- | --- |
| 指标名、版本、源码基线 | 从本文及源码记录 | 产品版本、公式文档链接及日期 |
| 输入及单位 | OHLC、量、额、历史区间 | 是否完全一致 |
| 参数及实际作用 | 参数顺序、哪些参与计算 | 参数定义 |
| 主公式 | 本文章节公式 | 平台公式 |
| 平滑类型和种子 | MA／EMA／RMA 及初始化 | 对应定义 |
| 首个有效下标 | 指标索引及具体数据 | 实测位置 |
| 零分母、平价、缺值 | 本文章节边界 | 对应规则 |
| 比例、符号、偏移 | 100、2、$10^8$、正负、CR 位移等 | 对应规则 |
| 状态与显示 | TD 原始引擎输出和过滤后输出 | 比较的是哪一层 |
| 首个不一致样本 | 时间、输入、期望值、实际值 | 原始数值或事件 |
| 结论 | 一致／仅初始化不同／公式不同／资料不足 | 说明证据与范围 |

## 相关源码与验证入口

指标注册见 [index.ts](../src/extension/indicator/index.ts)，计算结果和显示精度的包装见 [Indicator.ts](../src/component/Indicator.ts)。数值章节已经分别链接实际计算文件。

可运行现有指标范围测试：

```sh
npm run test:unit -- src/extension/indicator
```

这些现有测试主要覆盖 ATR、ATR_CHANNELS、ASI、PBX、MIKE 和 TD 系列，不能将其通过解释为 38 个指标均已与外部平台逐柱验证。跨平台结论仍需使用同一组原始输入和对方确认的公式。
