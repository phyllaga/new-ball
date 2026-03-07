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

export async function getBet365All({
                                       baseUrl = DEFAULT_BASE_URL,
                                       userId = 1000,
                                       day,
                                       leagueIds,
                                       daysOfTime = 1,
                                   } = {}) {
    // 滚球时允许 leagueIds 为空字符串，表示查全部滚球；早盘必须传联赛 id
    if (leagueIds == null) {
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