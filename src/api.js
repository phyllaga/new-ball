// api.js

const DEFAULT_BASE_URL = "https://ball.skybit.shop";

/** day 支持：时间戳（毫秒，推荐，表示用户本地时区当天 0 点）或 yyyy-MM-dd 字符串；原样传给后端 */
function normalizeDayParam(day) {
    if (day == null || day === "") return undefined;
    if (typeof day === "number" && !Number.isNaN(day)) return day;
    if (typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
    const d = typeof day === "string" && /^\d+$/.test(day) ? new Date(day.length <= 10 ? Number(day) * 1000 : Number(day)) : new Date(day);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.getTime();
}

function buildQuery(params = {}) {
    const search = new URLSearchParams();

    Object.keys(params).forEach((key) => {
        const value = params[key];
        if (value !== undefined && value !== null && value !== "") {
            search.append(key, value);
        }
    });

    return search.toString();
}

export async function getLeagueGroup({
                                         baseUrl = DEFAULT_BASE_URL,
                                         userId = 1000,
                                         type = 0,
                                         sportId = 1,
                                         day,
                                         daysOfTime = 1,
                                     } = {}) {
    const query = buildQuery({
        debug: true,
        userId,
        type,
        sportId,
        day: normalizeDayParam(day),
        daysOfTime,
    });

    const url = `${baseUrl}/soccer/event/league-group?${query}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`获取联赛列表失败，HTTP ${response.status}`);
    }

    const json = await response.json();

    return {
        url,
        data: json,
    };
}

/** 请求时带 debug & userId，便于测试环境识别用户 */
function authParams(userId) {
    return { debug: true, userId: userId || "1000" };
}

/** 下单前拉取最新赔率 POST /soccer/event/new-odds */
export async function newOdds({ baseUrl = DEFAULT_BASE_URL, userId, betOrderList = [], isBestOdd = false } = {}) {
    const query = buildQuery(authParams(userId));
    const url = `${(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "")}/soccer/event/new-odds?${query}`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betOrderList, isBestOdd }),
    });
    if (!res.ok) throw new Error(`new-odds 失败 HTTP ${res.status}`);
    const json = await res.json();
    return { url, data: json };
}

/** 单笔下单 POST /order/add (form) */
export async function createOrder({ baseUrl = DEFAULT_BASE_URL, userId, betOrder, isBestOdd = false } = {}) {
    const params = new URLSearchParams(buildQuery(authParams(userId)));
    if (betOrder) {
        Object.entries(betOrder).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
        });
        params.append("isBestOdd", isBestOdd ? "true" : "false");
    }
    const url = `${(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "")}/order/add`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });
    const json = await res.json();
    return { url, data: json };
}

/** 串关下单 POST /order/contact/add */
export async function createContactOrder({ baseUrl = DEFAULT_BASE_URL, userId, betOrderList = [], isBestOdd = false } = {}) {
    const query = buildQuery(authParams(userId));
    const url = `${(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "")}/order/contact/add?${query}`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betOrderList, isBestOdd }),
    });
    const json = await res.json();
    return { url, data: json };
}

/** 订单列表 GET /order/list  type=0 未结算  type=1 已结算(需传 day) */
export async function getOrderList({ baseUrl = DEFAULT_BASE_URL, userId, type = 0, page = 1, size = 20, day } = {}) {
    const q = buildQuery({ ...authParams(userId), type, page, size, day });
    const url = `${(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "")}/order/list?${q}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`order/list 失败 HTTP ${res.status}`);
    const json = await res.json();
    return { url, data: json };
}

/** 结算汇总 GET /order/flow */
export async function getOrderFlow({ baseUrl = DEFAULT_BASE_URL, userId } = {}) {
    const q = buildQuery(authParams(userId));
    const url = `${(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "")}/order/flow?${q}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`order/flow 失败 HTTP ${res.status}`);
    const json = await res.json();
    return { url, data: json };
}

export async function getBet365All({
                                       baseUrl = DEFAULT_BASE_URL,
                                       userId = 1000,
                                       day,
                                       leagueIds,
                                       daysOfTime = 1,
                                   } = {}) {
    // 早盘、滚球都必须传 leagueIds 筛选，不传则后端返回空列表
    if (leagueIds == null || leagueIds === "") {
        throw new Error("leagueIds 不能为空");
    }

    const query = buildQuery({
        debug: true,
        userId,
        day: normalizeDayParam(day),
        leagueIds,
        daysOfTime,
    });

    const url = `${baseUrl}/soccer/event/bet365/all?${query}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`获取比赛列表失败，HTTP ${response.status}`);
    }

    const json = await response.json();

    return {
        url,
        data: json,
    };
}