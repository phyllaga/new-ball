import {
    formatInplaySelectionLabel,
    formatPreSelectionLabel,
    getInplayOddsMarkets,
    getInplayTeamType,
    getPreTeamType,
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
});
