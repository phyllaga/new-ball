import {
    formatInplaySelectionLabel,
    formatPreSelectionLabel,
    getInplayOddsMarkets,
    getInplayTeamType,
    getPreTeamType,
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
});
