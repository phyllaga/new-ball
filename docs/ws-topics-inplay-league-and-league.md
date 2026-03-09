# WebSocket 新增 topic 对接说明（inplay-league / league）

前端已支持两个新 topic 的订阅与推送处理，后端需在 `/ws/soccer` 中解析 `topics` 并实现对应推送。

## 1. 订阅消息格式

客户端连接成功后（以及 `eventIds`/`leagueId` 变化时）会发送：

```json
{
  "type": "subscribe",
  "eventIds": ["123", "456"],
  "topics": ["inplay-league", "league:987"]
}
```

- **eventIds**：原有字段，订阅具体赛事的赔率推送，逻辑不变。
- **topics**：新增字段，字符串数组。
  - `"inplay-league"`：订阅滚球联赛列表变更（联赛增/减时推送）。
  - `"league:{leagueId}"`：订阅指定联赛下的赛事列表变更（新增赛事、赛事结束等），例如 `"league:987"`。

后端需要：
- 解析 `subscribe` 消息中的 `topics`（可能不存在，则视为 `[]`）。
- 为每个连接维护其订阅的 topic 集合（如 `Set<String>`），支持后续重发 subscribe 时覆盖该连接的 topics。

---

## 2. topic：inplay-league（滚球联赛列表）

- **含义**：客户端订阅「当前滚球联赛列表」的变更。
- **推送时机**：滚球联赛列表发生变化时（有新联赛出现、或某联赛下无滚球赛事被移除）。
- **推送对象**：所有订阅了 `inplay-league` 的连接。
- **推送格式**（与前端 `getLeagueGroup` / 联赛列表接口一致）：

```json
{
  "type": "inplay_league",
  "data": [
    { "leagueId": "123", "leagueName": "英超", "..." },
    { "leagueId": "456", "leagueName": "西甲", "..." }
  ]
}
```

或（兼容前端 `data.data` 结构）：

```json
{
  "type": "inplay_league",
  "data": {
    "data": [
      { "leagueId": "123", "leagueName": "英超", "..." },
      { "leagueId": "456", "leagueName": "西甲", "..." }
    ]
  }
}
```

前端会使用 `data` 或 `data.data` 作为联赛列表并刷新左侧联赛列表。

**说明**：前端同时识别 `type === "inplay-league"`（带横线），与 `inplay_league` 二选一即可。

---

## 3. topic：league:{leagueId}（某联赛下赛事列表）

- **含义**：客户端订阅「指定联赛下滚球赛事列表」的变更。
- **推送时机**：该联赛下有赛事新增、或赛事结束（或其他导致列表变化）时。
- **推送对象**：所有订阅了 `league:{leagueId}` 且 `leagueId` 与发生变化的联赛一致的连接。
- **推送格式**（与前端 `getBet365All` 单联赛 inPlay 结构一致）：

```json
{
  "type": "league",
  "data": {
    "leagueId": "987",
    "data": {
      "inPlay": [
        { "key": "987", "value": [ { "id": "e1", "..." }, { "id": "e2", "..." } ] }
      ]
    }
  }
}
```

或（直接 inPlay 数组）：

```json
{
  "type": "league",
  "data": {
    "leagueId": "987",
    "inPlay": [
      { "key": "987", "value": [ { "id": "e1", "..." }, { "id": "e2", "..." } ] }
    }
  }
}
```

前端仅在 `data.leagueId === 当前选中的联赛ID` 时用该推送更新中间比赛列表；否则忽略。

---

## 4. 后端实现要点（伪代码）

- **连接建立**：按 token 鉴权后，为该 session 维护 `Set<String> subscribedTopics`（以及原有 eventIds）。
- **收到 subscribe**：
  - 更新 `eventIds`；
  - 若消息带 `topics`，则 `subscribedTopics = new Set(topics)`，否则保留原 topics（或清空，按业务约定）。
- **滚球联赛列表变更时**（如定时/事件拉取或 MQ 收到联赛列表变更）：
  - 若某连接 `subscribedTopics.contains("inplay-league")`，则向该连接推送 `{ type: "inplay_league", data: leagueList }`。
- **某联赛下赛事列表变更时**（如赛事开始/结束或 MQ）：
  - 若某连接 `subscribedTopics.contains("league:" + leagueId)`，则向该连接推送 `{ type: "league", data: { leagueId, data: { inPlay: [...] } } }`（或上述另一种 data 结构）。

数据源可与现有 `league-group`、`bet365/all` 等接口一致，保证前端展示结构与首次拉取一致即可。

---

## 5. 前端已做处理（供参考）

- **useOddsSocket.js**：在 subscribe 中带上 `topics`；`onmessage` 中根据 `type === "inplay_league"` / `"inplay-league"` 和 `type === "league"` 调用 `onInplayLeagueUpdate(data)`、`onLeagueEventsUpdate(data)`。
- **Ball.jsx**：滚球模式下传入 `leagueId: selectedLeague?.leagueId` 和上述两个回调；联赛列表推送时 `setLeagueList`；联赛赛事推送时若 `data.leagueId === 当前选中联赛` 则更新 `matchRaw`，中间列表自动刷新。

后端按本文约定实现订阅与推送后，前端无需再改即可联动。
