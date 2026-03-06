import React, { useEffect, useMemo, useState } from "react";
import { getBet365All, getLeagueGroup } from "./api";

function getMatchListFromOddsResponse(raw) {
    // 尽量兼容不同返回结构
    if (!raw) return [];

    const data = raw?.data?.data ?? raw?.data ?? raw;

    if (Array.isArray(data)) return data;

    if (Array.isArray(data?.list)) return data.list;
    if (Array.isArray(data?.matchList)) return data.matchList;
    if (Array.isArray(data?.events)) return data.events;
    if (Array.isArray(data?.data)) return data.data;

    return [];
}

function getMatchKey(match, index) {
    return (
        match?.eventId ||
        match?.matchId ||
        match?.id ||
        `${match?.homeTeamName || "home"}_${match?.awayTeamName || "away"}_${index}`
    );
}

function getHomeName(match) {
    return (
        match?.homeTeamName ||
        match?.homeName ||
        match?.team1Name ||
        match?.home ||
        "主队"
    );
}

function getAwayName(match) {
    return (
        match?.awayTeamName ||
        match?.awayName ||
        match?.team2Name ||
        match?.away ||
        "客队"
    );
}

function getMatchTime(match) {
    return (
        match?.matchTime ||
        match?.startTime ||
        match?.eventTime ||
        match?.time ||
        "-"
    );
}

function getScore(match) {
    if (match?.score) return match.score;
    if (match?.homeScore !== undefined || match?.awayScore !== undefined) {
        return `${match?.homeScore ?? 0} : ${match?.awayScore ?? 0}`;
    }
    return "-";
}

export default function SoccerEarlyMarketPage() {
    const [baseUrl, setBaseUrl] = useState("http://43.198.223.119:8080");
    const [userId, setUserId] = useState("1000");
    const [type, setType] = useState("0");

    const [leagueList, setLeagueList] = useState([]);
    const [selectedLeague, setSelectedLeague] = useState(null);

    const [leagueLoading, setLeagueLoading] = useState(false);
    const [matchLoading, setMatchLoading] = useState(false);
    const [error, setError] = useState("");

    const [leagueRaw, setLeagueRaw] = useState(null);
    const [matchRaw, setMatchRaw] = useState(null);

    const matchList = useMemo(() => getMatchListFromOddsResponse(matchRaw), [matchRaw]);

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
            });

            const list = Array.isArray(res?.data?.data) ? res.data.data : [];
            setLeagueRaw(res);
            setLeagueList(list);

            if (list.length > 0) {
                setSelectedLeague(list[0]);
            }
        } catch (err) {
            setError(err.message || "获取联赛列表失败");
            setLeagueList([]);
            setLeagueRaw(null);
        } finally {
            setLeagueLoading(false);
        }
    };

    const loadMatchesByLeague = async (league) => {
        if (!league?.leagueId) return;

        setError("");
        setSelectedLeague(league);
        setMatchLoading(true);

        try {
            const res = await getBet365All({
                baseUrl,
                userId,
                day: Date.now(),
                leagueIds: league.leagueId,
            });

            setMatchRaw({
                request: {
                    leagueName: league.leagueName,
                    leagueId: league.leagueId,
                    day: Date.now(),
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

    useEffect(() => {
        loadLeagues();
    }, []);

    useEffect(() => {
        if (selectedLeague?.leagueId) {
            loadMatchesByLeague(selectedLeague);
        }
    }, [selectedLeague?.leagueId]);

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#f5f7fb",
                padding: 20,
                color: "#111827",
                fontFamily:
                    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif',
            }}
        >
            <div style={{ maxWidth: 1480, margin: "0 auto" }}>
                <div
                    style={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 16,
                        padding: 18,
                        marginBottom: 16,
                    }}
                >
                    <div style={{ fontSize: 24, fontWeight: 700 }}>足球早盘 / 比赛列表</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
                        左侧联赛，右侧比赛列表。当前点击联赛后自动请求 bet365/all。
                    </div>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1.6fr 0.7fr 0.7fr auto",
                        gap: 12,
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 16,
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

                <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
                    <div
                        style={{
                            background: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 16,
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                padding: 16,
                                borderBottom: "1px solid #e5e7eb",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 700 }}>联赛列表</div>
                                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                                    共 {leagueList.length} 条
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: 12, maxHeight: 760, overflowY: "auto" }}>
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
                                            onClick={() => loadMatchesByLeague(league)}
                                            style={{
                                                marginBottom: 10,
                                                padding: 14,
                                                borderRadius: 12,
                                                cursor: "pointer",
                                                border: active ? "1px solid #111827" : "1px solid #e5e7eb",
                                                background: active ? "#111827" : "#fff",
                                                color: active ? "#fff" : "#111827",
                                                transition: "all 0.2s ease",
                                            }}
                                        >
                                            <div style={{ fontWeight: 600, lineHeight: 1.4 }}>{league.leagueName}</div>
                                            <div style={{ fontSize: 12, marginTop: 8, opacity: 0.85 }}>
                                                leagueId: {league.leagueId}
                                            </div>
                                            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>
                                                sportId: {league.sportId} / type: {league.type}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateRows: "1fr 320px", gap: 16 }}>
                        <div
                            style={{
                                background: "#fff",
                                border: "1px solid #e5e7eb",
                                borderRadius: 16,
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    padding: 16,
                                    borderBottom: "1px solid #e5e7eb",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 700 }}>比赛列表</div>
                                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                                        {selectedLeague
                                            ? `${selectedLeague.leagueName}（${selectedLeague.leagueId}）`
                                            : "请选择联赛"}
                                    </div>
                                </div>

                                {selectedLeague ? (
                                    <button
                                        onClick={() => loadMatchesByLeague(selectedLeague)}
                                        style={{
                                            height: 36,
                                            padding: "0 14px",
                                            border: "1px solid #d1d5db",
                                            borderRadius: 10,
                                            background: "#fff",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {matchLoading ? "刷新中..." : "刷新比赛"}
                                    </button>
                                ) : null}
                            </div>

                            <div style={{ padding: 16, maxHeight: 420, overflowY: "auto" }}>
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
                                                borderRadius: 14,
                                                padding: 16,
                                                marginBottom: 12,
                                                background: "#fafafa",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    gap: 12,
                                                    marginBottom: 10,
                                                }}
                                            >
                                                <div style={{ fontSize: 12, color: "#6b7280" }}>
                                                    时间：{getMatchTime(match)}
                                                </div>
                                                <div style={{ fontSize: 12, color: "#6b7280" }}>
                                                    比分：{getScore(match)}
                                                </div>
                                            </div>

                                            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>
                                                {getHomeName(match)} VS {getAwayName(match)}
                                            </div>

                                            <div
                                                style={{
                                                    display: "flex",
                                                    gap: 12,
                                                    flexWrap: "wrap",
                                                    marginTop: 12,
                                                    fontSize: 12,
                                                    color: "#4b5563",
                                                }}
                                            >
                                                {match?.eventId !== undefined && (
                                                    <span
                                                        style={{
                                                            background: "#eef2ff",
                                                            color: "#4338ca",
                                                            padding: "4px 8px",
                                                            borderRadius: 999,
                                                        }}
                                                    >
                            eventId: {match.eventId}
                          </span>
                                                )}

                                                {match?.marketCount !== undefined && (
                                                    <span
                                                        style={{
                                                            background: "#ecfeff",
                                                            color: "#0f766e",
                                                            padding: "4px 8px",
                                                            borderRadius: 999,
                                                        }}
                                                    >
                            盘口数: {match.marketCount}
                          </span>
                                                )}

                                                {match?.status !== undefined && (
                                                    <span
                                                        style={{
                                                            background: "#f3f4f6",
                                                            color: "#374151",
                                                            padding: "4px 8px",
                                                            borderRadius: 999,
                                                        }}
                                                    >
                            状态: {String(match.status)}
                          </span>
                                                )}
                                            </div>
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

                        <div
                            style={{
                                background: "#fff",
                                border: "1px solid #e5e7eb",
                                borderRadius: 16,
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    padding: 16,
                                    borderBottom: "1px solid #e5e7eb",
                                    fontWeight: 700,
                                }}
                            >
                                原始返回数据
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, height: 100% }}>
                                <div style={{ borderRight: "1px solid #e5e7eb", padding: 16 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>联赛接口</div>
                                    <pre
                                        style={{
                                            margin: 0,
                                            background: "#0f172a",
                                            color: "#e2e8f0",
                                            borderRadius: 12,
                                            padding: 12,
                                            overflow: "auto",
                                            height: 220,
                                            fontSize: 12,
                                            lineHeight: 1.5,
                                        }}
                                    >
                    {JSON.stringify(leagueRaw, null, 2)}
                  </pre>
                                </div>

                                <div style={{ padding: 16 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>比赛接口</div>
                                    <pre
                                        style={{
                                            margin: 0,
                                            background: "#0f172a",
                                            color: "#e2e8f0",
                                            borderRadius: 12,
                                            padding: 12,
                                            overflow: "auto",
                                            height: 220,
                                            fontSize: 12,
                                            lineHeight: 1.5,
                                        }}
                                    >
                    {JSON.stringify(matchRaw, null, 2)}
                  </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}