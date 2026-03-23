import {
    formatInplaySelectionLabel,
    formatPreSelectionLabel,
    getInplayOddsMarkets,
    getInplayTeamType,
    getPreTeamType,
    isSingleOnlyMarket,
    normalizeTeamType,
} from "./Ball";

const match = {
    homeNameCN: "主队A",
    awayNameCN: "客队B",
};

describe("Ball market helpers", () => {
    test("大小球早盘使用 Over/Under 作为 teamType，并展示中文标签与盘口", () => {
        const item = { header: "Over", name: "2.5", odds: "1.85" };

        expect(getPreTeamType("10143_goal_line", item, match)).toBe("Over");
        expect(formatPreSelectionLabel(match, "10143_goal_line", item)).toBe("大球 2.5");
    });

    test("波胆早盘使用 header+比分 作为 teamType", () => {
        const homeWin = { header: "1", name: "2-1", odds: "9.0" };
        const draw = { header: "Draw", name: "1-1", odds: "6.5" };

        expect(getPreTeamType("43_correct_score", homeWin, match)).toBe("1&2-1");
        expect(getPreTeamType("43_correct_score", draw, match)).toBe("X&1-1");
        expect(formatPreSelectionLabel(match, "43_correct_score", homeWin)).toBe("主队A 2-1");
        expect(formatPreSelectionLabel(match, "43_correct_score", draw)).toBe("平局 1-1");
    });

    test("滚球大小球和波胆映射到后端结算 key", () => {
        expect(getInplayOddsMarkets("1786")).toBe("1786_To Qualify");
        expect(getInplayOddsMarkets("10115")).toBe("10115_Double Chance");
        expect(getInplayOddsMarkets("10560")).toBe("10560_Half Time/Full Time");
        expect(getInplayOddsMarkets("50246")).toBe("50246_To Win 2nd Half");
        expect(getInplayOddsMarkets("50390")).toBe("50390_Both Teams to Score in 1st Half");
        expect(getInplayOddsMarkets("50391")).toBe("50391_Both Teams to Score in 2nd Half");
        expect(getInplayOddsMarkets("50461")).toBe("50461_Result / Both Teams To Score");
        expect(getInplayOddsMarkets("10565")).toBe("10565_Both Teams to Score");
        expect(getInplayOddsMarkets("50169")).toBe("50169_Extra Time Result");
        expect(getInplayOddsMarkets("439")).toBe("439_Extra Time Asian Handicap");
        expect(getInplayOddsMarkets("430")).toBe("430_Extra Time Goal Line");
        expect(getInplayOddsMarkets("50591")).toBe("50591_Extra Time Final Score");
        expect(getInplayOddsMarkets("50151")).toBe("50151_To Win Shootout");
        expect(getInplayOddsMarkets("440")).toBe("440_Asian Handicap - Penalties converted in Shootout");
        expect(getInplayOddsMarkets("431")).toBe("431_Goal Line - Penalties Converted in Shootout");
        expect(getInplayOddsMarkets("50275")).toBe("50275_Shootout Correct Score");
        expect(getInplayOddsMarkets("10148")).toBe("10148_Goal Line");
        expect(getInplayOddsMarkets("10171")).toBe("10171_1st Half Goal Line");
        expect(getInplayOddsMarkets("10001")).toBe("10001_Final Score");
        expect(getInplayOddsMarkets("10561")).toBe("10561_Half Time Correct Score");
    });

    test("滚球波胆使用盘口方向和比分拼接 teamType，并展示中文标签", () => {
        const mavo = { id: "10001" };
        const pa = { ha: "2", na: "1-0" };

        expect(getInplayTeamType(mavo, pa, match)).toBe("2&1-0");
        expect(formatInplaySelectionLabel(match, mavo, pa)).toBe("客队B 1-0");
    });

    test("双重机会早盘统一 teamType 编码，并显示中文组合", () => {
        const fullTime = { name: "X2", odds: "1.45" };
        const halfTime = { name: "1X", odds: "1.33" };

        expect(getPreTeamType("10114_double_chance", fullTime, match)).toBe("X&2");
        expect(getPreTeamType("10257_half_time_double_chance", halfTime, match)).toBe("1&X");
        expect(formatPreSelectionLabel(match, "10114_double_chance", fullTime)).toBe("平局 / 客队B");
        expect(formatPreSelectionLabel(match, "10257_half_time_double_chance", halfTime)).toBe("主队A / 平局");
    });

    test("晋级玩法使用 1/2 teamType 并展示球队名", () => {
        const qualify = { name: "主队A", odds: "1.70" };

        expect(getPreTeamType("1094_to_qualify", qualify, match)).toBe("1");
        expect(formatPreSelectionLabel(match, "1094_to_qualify", qualify)).toBe("主队A");
    });

    test("加时让球与加时波胆沿用让球/波胆编码规则", () => {
        const handicapMavo = { id: "439" };
        const handicapPa = { na: "主队A", ha: "-0.5" };
        const scoreMavo = { id: "50591" };
        const scorePa = { ha: "1", na: "2-1" };

        expect(getInplayTeamType(handicapMavo, handicapPa, match)).toBe("1");
        expect(formatInplaySelectionLabel(match, handicapMavo, handicapPa)).toBe("主队A (-0.5)");
        expect(getInplayTeamType(scoreMavo, scorePa, match)).toBe("1&2-1");
        expect(formatInplaySelectionLabel(match, scoreMavo, scorePa)).toBe("主队A 2-1");
    });

    test("半全场玩法把名称组合转为 1/X/2 的 teamType", () => {
        const preItem = { name: "主队A - 平局", odds: "6.0" };
        const inplayMavo = { id: "10560" };
        const inplayPa = { na: "Draw - 客队B" };

        expect(getPreTeamType("42_half_time_full_time", preItem, match)).toBe("1&X");
        expect(formatPreSelectionLabel(match, "42_half_time_full_time", preItem)).toBe("主队A / 平局");
        expect(getInplayTeamType(inplayMavo, inplayPa, match)).toBe("X&2");
        expect(formatInplaySelectionLabel(match, inplayMavo, inplayPa)).toBe("平局 / 客队B");
    });

    test("点球主玩法沿用独赢/让球/大小球/波胆编码", () => {
        const shootoutResult = { id: "50151" };
        const shootoutHandicap = { id: "440" };
        const shootoutGoalLine = { id: "431" };
        const shootoutScore = { id: "50275" };

        expect(getInplayTeamType(shootoutResult, { na: "主队A" }, match)).toBe("1");
        expect(formatInplaySelectionLabel(match, shootoutResult, { na: "主队A" })).toBe("主队A");
        expect(getInplayTeamType(shootoutHandicap, { na: "客队B", ha: "+0.5" }, match)).toBe("2");
        expect(formatInplaySelectionLabel(match, shootoutHandicap, { na: "客队B", ha: "+0.5" })).toBe("客队B (+0.5)");
        expect(formatInplaySelectionLabel(match, shootoutGoalLine, { na: "Under", ha: "7.5" })).toBe("小球 7.5");
        expect(getInplayTeamType(shootoutScore, { ha: "1", na: "4-3" }, match)).toBe("1&4-3");
    });

    test("角球玩法沿用让球/大小球格式，确保展示和 teamType 可下单", () => {
        const cornerGoalLine = { header: "Under", name: "9.5", odds: "1.90" };
        const cornerHandicap = { header: "主队A", handicap: "-1.5", odds: "1.88" };

        expect(getPreTeamType("760_corners", cornerGoalLine, match)).toBe("Under");
        expect(formatPreSelectionLabel(match, "760_corners", cornerGoalLine)).toBe("小球 9.5");
        expect(getPreTeamType("10535_corner_handicap", cornerHandicap, match)).toBe("1");
        expect(formatPreSelectionLabel(match, "10535_corner_handicap", cornerHandicap)).toBe("主队A (-1.5)");
    });

    test("双重机会历史编码兼容 2&X 并统一到 X&2", () => {
        expect(normalizeTeamType("2&X", match)).toBe("X&2");
        expect(normalizeTeamType("X2", match)).toBe("X&2");
    });

    test("BTTS 使用 Yes/No 编码并展示中文", () => {
        const yesItem = { name: "Yes", odds: "1.70" };
        const noItem = { name: "No", odds: "2.00" };

        expect(getPreTeamType("10150_both_teams_to_score", yesItem, match)).toBe("Yes");
        expect(getPreTeamType("10150_both_teams_to_score", noItem, match)).toBe("No");
        expect(formatPreSelectionLabel(match, "10150_both_teams_to_score", yesItem)).toBe("是");
        expect(formatPreSelectionLabel(match, "10150_both_teams_to_score", noItem)).toBe("否");
    });

    test("下半场玩法使用独赢/单双编码规则", () => {
        const secondHalfResult = { name: "主队A", odds: "2.20" };
        const secondHalfOddEven = { name: "Odd", odds: "1.95" };

        expect(getPreTeamType("10208_2nd_half_result", secondHalfResult, match)).toBe("1");
        expect(formatPreSelectionLabel(match, "10208_2nd_half_result", secondHalfResult)).toBe("主队A");
        expect(getPreTeamType("50433_2nd_half_goals_odd_even", secondHalfOddEven, match)).toBe("Odd");
        expect(formatPreSelectionLabel(match, "50433_2nd_half_goals_odd_even", secondHalfOddEven)).toBe("单");
    });

    test("冠军/晋级 market id 标记为仅支持单关", () => {
        expect(isSingleOnlyMarket("1094_to_qualify")).toBe(true);
        expect(isSingleOnlyMarket("1786_To Qualify")).toBe(true);
        expect(isSingleOnlyMarket("10116_to_win_the_trophy")).toBe(true);
        expect(isSingleOnlyMarket("40_full_time_result")).toBe(false);
    });
});
