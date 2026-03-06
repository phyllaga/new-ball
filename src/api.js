// api.js

const DEFAULT_BASE_URL = "http://43.198.223.119:8080";

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
                                     } = {}) {
    const query = buildQuery({
        debug: true,
        userId,
        type,
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
                                       day = Date.now(),
                                       leagueIds,
                                   } = {}) {
    if (!leagueIds) {
        throw new Error("leagueIds 不能为空");
    }

    const query = buildQuery({
        debug: true,
        userId,
        day,
        leagueIds,
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