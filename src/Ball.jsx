import React, { useEffect, useMemo, useState, useRef } from "react";
import { getBet365All, getLeagueGroup } from "./api";
import { useOddsSocket } from "./useOddsSocket";

function getMatchListFromOddsResponse(raw, matchType) {
    // 尽量兼容不同返回结构
    if (!raw) return [];

    const data = raw?.data?.data ?? raw?.data ?? raw;

    // bet365/all 格式: data.inPlay / data.preMatch = [ { key, value: [matches] } ]
    // matchType: "0" 或 0 = 早盘(preMatch)，"1" 或 1 = 滚球(inPlay)
    const isRolling = matchType === 1 || matchType === "1";
    const list = isRolling ? data?.inPlay : data?.preMatch;
    if (Array.isArray(list)) {
        return list.flatMap((item) => item?.value ?? []);
    }

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.list)) return data.list;
    if (Array.isArray(data?.matchList)) return data.matchList;
    if (Array.isArray(data?.events)) return data.events;

    return [];
}

/** 将 WS 推送的 MAVO 合并进 matchRaw：按 eventId 找到比赛，更新 treeResults 中同 id 的 MAVO */
function mergeMavoIntoMatchRaw(prevRaw, mavo) {
    if (!prevRaw || !mavo) return prevRaw;
    const eventId = mavo.eventId != null ? String(mavo.eventId) : null;
    if (eventId == null) return prevRaw;

    const data = prevRaw?.data?.data ?? prevRaw?.data ?? prevRaw;
    const inPlay = data?.inPlay;
    if (!Array.isArray(inPlay)) return prevRaw;

    const newInPlay = inPlay.map((group) => {
        const value = group?.value;
        if (!Array.isArray(value)) return group;
        const newValue = value.map((match) => {
            const mid = match?.id != null ? String(match.id) : match?.bet365Id != null ? String(match.bet365Id) : null;
            if (mid !== eventId) return match;
            const tree = Array.isArray(match.treeResults) ? [...match.treeResults] : [];
            const idx = tree.findIndex((m) => (m?.id != null ? String(m.id) : null) === String(mavo.id));
            if (idx >= 0) {
                tree[idx] = mavo;
            } else {
                tree.push(mavo);
            }
            return { ...match, treeResults: tree };
        });
        return { ...group, value: newValue };
    });

    const newData = { ...data, inPlay: newInPlay };
    if (prevRaw.data?.data) {
        return { ...prevRaw, data: { ...prevRaw.data, data: newData } };
    }
    if (prevRaw.data) {
        return { ...prevRaw, data: { ...prevRaw.data, ...newData } };
    }
    return { ...prevRaw, ...newData };
}

function getMatchKey(match, index) {
    return (
        match?.id ||
        match?.bet365Id ||
        match?.eventId ||
        match?.matchId ||
        `${match?.homeNameCN || match?.homeTeamName || "home"}_${match?.awayNameCN || match?.awayTeamName || "away"}_${index}`
    );
}

function getHomeName(match) {
    return (
        match?.homeNameCN ||
        match?.homeNameEN ||
        match?.homeTeamName ||
        match?.homeName ||
        match?.team1Name ||
        match?.home ||
        "主队"
    );
}

function getAwayName(match) {
    return (
        match?.awayNameCN ||
        match?.awayNameEN ||
        match?.awayTeamName ||
        match?.awayName ||
        match?.team2Name ||
        match?.away ||
        "客队"
    );
}

/** 比赛时间统一按新加坡时间展示 */
function getMatchTime(match) {
    const t = match?.time ?? match?.matchTime ?? match?.startTime ?? match?.eventTime;
    if (t == null) return "-";
    const ts = typeof t === "number" ? t * (t < 1e10 ? 1000 : 1) : new Date(t).getTime();
    const d = new Date(ts);
    return d.toLocaleString("zh-CN", {
        timeZone: "Asia/Singapore",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getScore(match) {
    if (match?.score) return match.score;
    if (match?.ballScore != null && typeof match.ballScore === "string") return match.ballScore;
    if (match?.homeScore !== undefined || match?.awayScore !== undefined) {
        return `${match?.homeScore ?? 0} : ${match?.awayScore ?? 0}`;
    }
    return "-";
}

// 主要玩法展示顺序（bet365 风格）
const MAIN_MARKET_KEYS = [
    { key: "40_full_time_result", label: "胜平负" },
    { key: "938_asian_handicap", label: "亚盘" },
    { key: "981_goals_over_under", label: "大小球" },
    { key: "10143_goal_line", label: "球半" },
    { key: "43_correct_score", label: "波胆" },
    { key: "1579_half_time_result", label: "半场胜平负" },
    { key: "10257_half_time_double_chance", label: "半场双重机会" },
];

/** 新加坡时间当天 0 点的毫秒时间戳 */
function getStartOfDaySingapore(date) {
    const f = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Singapore",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const [y, m, d] = f.format(date).split("-").map(Number);
    return Date.UTC(y, m - 1, d, -8, 0, 0);
}

function getDateTabLabel(dayIndex) {
    if (dayIndex === 0) return "今日";
    if (dayIndex === 1) return "明天";
    if (dayIndex === 2) return "后天";
    const start = getStartOfDaySingapore(new Date()) + dayIndex * 24 * 3600 * 1000;
    const d = new Date(start);
    return d.toLocaleDateString("zh-CN", {
        timeZone: "Asia/Singapore",
        month: "numeric",
        day: "numeric",
    });
}

// day = 新加坡“选中日”0 点的时间戳(ms)，与后端一致
function getSelectedDayTimestamp(dayIndex) {
    const now = new Date();
    return getStartOfDaySingapore(now) + dayIndex * 24 * 3600 * 1000;
}

function MarketOddsCell({ marketKey, label, oddsObj }) {
    if (!oddsObj?.odds?.length) return null;
    const list = oddsObj.odds;

    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{label || oddsObj.name}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {list.map((item, i) => (
                    <span
                        key={item.id || i}
                        style={{
                            fontSize: 13,
                            padding: "4px 10px",
                            background: "#f3f4f6",
                            borderRadius: 6,
                            color: "#111827",
                        }}
                    >
                        {item.header ? `${item.header} ` : ""}
                        {item.name != null ? item.name : item.handicap}
                        <span style={{ marginLeft: 6, fontWeight: 600 }}>{item.odds}</span>
                    </span>
                ))}
            </div>
        </div>
    );
}

/** 滚球：单个玩法（MAVO）展示，co[].pa 为选项，na/pNa 名称，od 赔率，ha 盘口 */
function RollingMarketCell({ mavo }) {
    const options = mavo?.co?.flatMap((c) => c.pa || []) ?? [];
    if (options.length === 0) return null;
    const title = mavo.na || mavo.id || "";

    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{title}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {options.map((pa, i) => (
                    <span
                        key={pa.id || i}
                        style={{
                            fontSize: 13,
                            padding: "4px 10px",
                            background: "#f3f4f6",
                            borderRadius: 6,
                            color: "#111827",
                        }}
                    >
                        {(pa.na != null && pa.na !== "") ? pa.na : (pa.pNa != null ? pa.pNa : "-")}
                        {pa.ha != null && String(pa.ha).trim() !== "" && (
                            <span style={{ color: "#6b7280", marginLeft: 4 }}>({pa.ha})</span>
                        )}
                        {pa.od != null && (
                            <span style={{ marginLeft: 6, fontWeight: 600 }}>{pa.od}</span>
                        )}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function SoccerEarlyMarketPage() {
    const [baseUrl, setBaseUrl] = useState("https://ball.skybit.shop");
    const [userId, setUserId] = useState("1000");
    const [type, setType] = useState("0");

    const [leagueList, setLeagueList] = useState([]);
    const [selectedLeague, setSelectedLeague] = useState(null);

    const [leagueLoading, setLeagueLoading] = useState(false);
    const [matchLoading, setMatchLoading] = useState(false);
    const [error, setError] = useState("");

    const [matchRaw, setMatchRaw] = useState(null);

    /** 赔率 WS 更新高亮：{ eventId, maId }，约 600ms 后清除 */
    const [highlight, setHighlight] = useState(null);
    const highlightTimerRef = useRef(null);

    // 日期 Tab：0=今日，1..9=往后 9 天；请求用 day=选中日 0 点时间戳(ms)，与后端一致，避免时区错位
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const selectedDayTs = getSelectedDayTimestamp(selectedDayIndex);

    const matchList = useMemo(
        () => getMatchListFromOddsResponse(matchRaw, type),
        [matchRaw, type]
    );

    const handleOddsUpdate = (mavo) => {
        setMatchRaw((prev) => mergeMavoIntoMatchRaw(prev, mavo));
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        setHighlight({ eventId: mavo.eventId != null ? String(mavo.eventId) : null, maId: mavo.id });
        highlightTimerRef.current = setTimeout(() => {
            setHighlight(null);
            highlightTimerRef.current = null;
        }, 600);
    };

    const { connected: wsConnected } = useOddsSocket({
        baseUrl,
        enabled: type === "1",
        onOddsUpdate: handleOddsUpdate,
    });

    const loadLeagues = async () => {
        setError("");
        setLeagueLoading(true);
        setSelectedLeague(null);
        setMatchRaw(null);

        try {
            const res = await getLeagueGroup({
                baseUrl,
                userId,
                type,
                sportId: 1,
                day: type === "1" ? undefined : selectedDayTs,
                daysOfTime: type === "1" ? undefined : 1,
            });

            const list = Array.isArray(res?.data?.data) ? res.data.data : [];
            setLeagueList(list);

            if (list.length > 0) {
                setSelectedLeague(list[0]);
            } else if (type === "1") {
                setSelectedLeague({ leagueId: "", leagueName: "全部" });
            }
        } catch (err) {
            setError(err.message || "获取联赛列表失败");
            setLeagueList([]);
        } finally {
            setLeagueLoading(false);
        }
    };

    const loadMatchesByLeague = async (league) => {
        if (type !== "1" && !league?.leagueId) return;

        setError("");
        setSelectedLeague(league);
        setMatchLoading(true);

        try {
            const res = await getBet365All({
                baseUrl,
                userId,
                day: type === "1" ? undefined : selectedDayTs,
                leagueIds: league?.leagueId ?? "",
                daysOfTime: type === "1" ? undefined : 1,
            });

            setMatchRaw({
                request: {
                    leagueName: league?.leagueName ?? "全部",
                    leagueId: league?.leagueId ?? "",
                    day: type === "1" ? undefined : selectedDayTs,
                    daysOfTime: type === "1" ? undefined : 1,
                },
                ...res,
            });
        } catch (err) {
            setError(err.message || "获取比赛列表失败");
            setMatchRaw(null);
        } finally {
            setMatchLoading(false);
        }
    };

    // 初始加载 + 切换日期/type 时刷新联赛列表
    useEffect(() => {
        loadLeagues();
    }, [selectedDayIndex, type]);

    // 滚球时 selectedLeague 可为「全部」(leagueId="")，也要请求；早盘需 selectedLeague.leagueId
    useEffect(() => {
        if (type === "1" ? selectedLeague != null : selectedLeague?.leagueId) {
            loadMatchesByLeague(selectedLeague);
        }
    }, [selectedLeague?.leagueId, selectedLeague?.leagueName, selectedDayTs, type]);

    return (
        <div
            style={{
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                background: "#f5f7fb",
                padding: 12,
                color: "#111827",
                fontFamily:
                    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif',
            }}
        >
            {/* 顶部：标题 + 接口配置，不占满宽 */}
            <div style={{ flexShrink: 0, marginBottom: 12 }}>
                <div
                    style={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: "12px 16px",
                        marginBottom: 12,
                    }}
                >
                    <div style={{ fontSize: 18, fontWeight: 700 }}>足球早盘 / 比赛列表</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        左侧联赛，右侧比赛列表。点击联赛后自动请求 bet365/all。
                    </div>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1.6fr 0.7fr 0.7fr auto",
                        gap: 12,
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 12,
                    }}
                >
                    <div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Base URL</div>
                        <input
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            style={{
                                width: "100%",
                                height: 40,
                                borderRadius: 10,
                                border: "1px solid #d1d5db",
                                padding: "0 12px",
                                outline: "none",
                            }}
                        />
                    </div>

                    <div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>userId</div>
                        <input
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            style={{
                                width: "100%",
                                height: 40,
                                borderRadius: 10,
                                border: "1px solid #d1d5db",
                                padding: "0 12px",
                                outline: "none",
                            }}
                        />
                    </div>

                    <div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>type</div>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            style={{
                                width: "100%",
                                height: 40,
                                borderRadius: 10,
                                border: "1px solid #d1d5db",
                                padding: "0 12px",
                                outline: "none",
                            }}
                        >
                            <option value="0">0 - 早盘</option>
                            <option value="1">1 - 滚球</option>
                        </select>
                    </div>

                    <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
                        <button
                            onClick={loadLeagues}
                            style={{
                                height: 40,
                                padding: "0 18px",
                                border: "none",
                                borderRadius: 10,
                                background: "#111827",
                                color: "#fff",
                                cursor: "pointer",
                                fontWeight: 600,
                            }}
                        >
                            {leagueLoading ? "加载中..." : "刷新联赛"}
                        </button>
                    </div>
                </div>
            </div>

                {error ? (
                    <div
                        style={{
                            marginBottom: 16,
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            color: "#dc2626",
                            padding: 12,
                            borderRadius: 12,
                        }}
                    >
                        {error}
                    </div>
                ) : null}

                {/* 联赛列表 + 比赛列表：占满剩余高度，左对齐 */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "280px 1fr",
                        gap: 12,
                        flex: 1,
                        minHeight: 0,
                        alignContent: "stretch",
                    }}
                >
                    <div
                        style={{
                            background: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 12,
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            minHeight: 0,
                        }}
                    >
                        <div
                            style={{
                                padding: "12px 14px",
                                borderBottom: "1px solid #e5e7eb",
                                flexShrink: 0,
                            }}
                        >
                            <div style={{ fontWeight: 700, fontSize: 15 }}>联赛列表</div>
                            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                                共 {leagueList.length} 条
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: "auto", padding: 10, minHeight: 0 }}>
                            {leagueList.length === 0 ? (
                                <div
                                    style={{
                                        border: "1px dashed #d1d5db",
                                        borderRadius: 12,
                                        padding: 16,
                                        color: "#6b7280",
                                        fontSize: 13,
                                    }}
                                >
                                    暂无联赛数据
                                </div>
                            ) : (
                                leagueList.map((league) => {
                                    const active = selectedLeague?.leagueId === league.leagueId;
                                    return (
                                        <div
                                            key={league.leagueId}
                                            onClick={() => setSelectedLeague(league)}
                                            style={{
                                                marginBottom: 8,
                                                padding: "10px 12px",
                                                borderRadius: 10,
                                                cursor: "pointer",
                                                border: active ? "1px solid #111827" : "1px solid #e5e7eb",
                                                background: active ? "#111827" : "#fff",
                                                color: active ? "#fff" : "#111827",
                                                transition: "all 0.2s ease",
                                            }}
                                        >
                                            <div style={{ fontWeight: 600, lineHeight: 1.35, fontSize: 14 }}>{league.leagueName}</div>
                                            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>
                                                leagueId: {league.leagueId}
                                            </div>
                                            <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>
                                                sportId: {league.sportId} / type: {league.type}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            minHeight: 0,
                            flex: 1,
                        }}
                    >
                        <div
                            style={{
                                background: "#fff",
                                border: "1px solid #e5e7eb",
                                borderRadius: 12,
                                overflow: "hidden",
                                display: "flex",
                                flexDirection: "column",
                                flex: 1,
                                minHeight: 0,
                            }}
                        >
                            <div
                                style={{
                                    padding: "12px 14px",
                                    borderBottom: "1px solid #e5e7eb",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>比赛列表</div>
                                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                                        {selectedLeague
                                            ? `${selectedLeague.leagueName}（${selectedLeague.leagueId}）`
                                            : "请选择联赛"}
                                        {type === "1" && (
                                            <span style={{ marginLeft: 8, color: wsConnected ? "#059669" : "#9ca3af" }}>
                                                · 赔率 WS: {wsConnected ? "已连接" : "连接中…"}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {selectedLeague ? (
                                    <button
                                        onClick={() => loadMatchesByLeague(selectedLeague)}
                                        style={{
                                            height: 34,
                                            padding: "0 12px",
                                            border: "1px solid #d1d5db",
                                            borderRadius: 8,
                                            background: "#fff",
                                            cursor: "pointer",
                                            fontSize: 13,
                                        }}
                                    >
                                        {matchLoading ? "刷新中..." : "刷新比赛"}
                                    </button>
                                ) : null}
                            </div>

                            {/* 日期 Tab：仅早盘时显示，滚球时不显示 */}
                            {type !== "1" && (
                            <div
                                style={{
                                    borderBottom: "1px solid #e5e7eb",
                                    padding: "10px 14px",
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 8,
                                    flexShrink: 0,
                                }}
                            >
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((dayIndex) => {
                                    const active = selectedDayIndex === dayIndex;
                                    return (
                                        <button
                                            key={dayIndex}
                                            type="button"
                                            onClick={() => setSelectedDayIndex(dayIndex)}
                                            style={{
                                                padding: "8px 14px",
                                                borderRadius: 10,
                                                border: active ? "1px solid #111827" : "1px solid #e5e7eb",
                                                background: active ? "#111827" : "#fff",
                                                color: active ? "#fff" : "#111827",
                                                fontSize: 13,
                                                fontWeight: 500,
                                                cursor: "pointer",
                                            }}
                                        >
                                            {getDateTabLabel(dayIndex)}
                                        </button>
                                    );
                                })}
                            </div>
                            )}

                            <div style={{ flex: 1, overflowY: "auto", padding: 12, minHeight: 0 }}>
                                {matchLoading ? (
                                    <div
                                        style={{
                                            border: "1px dashed #d1d5db",
                                            borderRadius: 12,
                                            padding: 28,
                                            textAlign: "center",
                                            color: "#6b7280",
                                        }}
                                    >
                                        比赛列表加载中...
                                    </div>
                                ) : matchList.length > 0 ? (
                                    matchList.map((match, index) => (
                                        <div
                                            key={getMatchKey(match, index)}
                                            style={{
                                                border: "1px solid #e5e7eb",
                                                borderRadius: 10,
                                                padding: 12,
                                                marginBottom: 10,
                                                background: "#fff",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    marginBottom: 8,
                                                    paddingBottom: 8,
                                                    borderBottom: "1px solid #e5e7eb",
                                                }}
                                            >
                                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                                    <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>
                                                        {getHomeName(match)} VS {getAwayName(match)}
                                                    </div>
                                                    {match?.timeStatus === "1" && (
                                                        <span
                                                            style={{
                                                                fontSize: 11,
                                                                fontWeight: 600,
                                                                color: "#dc2626",
                                                                background: "#fef2f2",
                                                                padding: "2px 8px",
                                                                borderRadius: 6,
                                                            }}
                                                        >
                                                            滚球
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                    {(match?.timeStatus === "1" || match?.ballScore) && getScore(match) !== "-" && (
                                                        <span style={{ fontSize: 15, color: "#059669", fontWeight: 700 }}>
                                                            {getScore(match)}
                                                        </span>
                                                    )}
                                                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                                                        {getMatchTime(match)}
                                                    </span>
                                                </div>
                                            </div>

                                            {match?.timeStatus === "1" && Array.isArray(match?.treeResults) && match.treeResults.length > 0 ? (
                                                <div
                                                    className={highlight && String(match?.id) === String(highlight.eventId) ? "odds-updated-flash" : ""}
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                                                        gap: 12,
                                                    }}
                                                >
                                                    {match.treeResults.map((mavo, idx) => (
                                                        <RollingMarketCell key={mavo.id || idx} mavo={mavo} />
                                                    ))}
                                                </div>
                                            ) : (
                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                                                    gap: 12,
                                                }}
                                            >
                                                {MAIN_MARKET_KEYS.map(({ key, label }) => {
                                                    const oddsObj = match?.odds?.[key];
                                                    return (
                                                        <MarketOddsCell
                                                            key={key}
                                                            marketKey={key}
                                                            label={label}
                                                            oddsObj={oddsObj}
                                                        />
                                                    );
                                                })}
                                            </div>
                                            )}

                                            {match?.id != null && (
                                                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>
                                                    ID: {match.id}
                                                    {match.bet365Id != null && ` · bet365: ${match.bet365Id}`}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div
                                        style={{
                                            border: "1px dashed #d1d5db",
                                            borderRadius: 12,
                                            padding: 28,
                                            textAlign: "center",
                                            color: "#6b7280",
                                        }}
                                    >
                                        暂无比赛数据
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    );
}