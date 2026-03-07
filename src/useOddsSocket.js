import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

/** 滚球赔率房间：后端 KafkaWsConstant.Room.ROOM_IN_PLAY */
export const ROOM_IN_PLAY = "5";

/** 服务端推送事件：KafkaWsConstant.WsMassage.MESSAGE_IN_PLAY_ODDS_UPDATE */
export const EVENT_IN_PLAY_ODDS_UPDATE = "in_play_odds_update";

/**
 * 连接 Socket.IO /soccer namespace，在滚球界面加入 ROOM_IN_PLAY，接收 in_play_odds_update。
 */
export function useOddsSocket({ baseUrl, enabled, onOddsUpdate }) {
    const [connected, setConnected] = useState(false);
    const onOddsUpdateRef = useRef(onOddsUpdate);
    onOddsUpdateRef.current = onOddsUpdate;

    useEffect(() => {
        if (!enabled || !baseUrl) {
            setConnected(false);
            return;
        }

        const serverUrl = (baseUrl || "").replace(/\/$/, "");
        const s = io(`${serverUrl}/soccer`, {
            path: "/ws/socket.io",
            transports: ["websocket"],
            autoConnect: true,
        });

        s.on("connect", () => {
            setConnected(true);
            s.emit("join", ROOM_IN_PLAY);
        });
        s.on("disconnect", () => setConnected(false));
        s.on("connect_error", () => setConnected(false));

        s.on(EVENT_IN_PLAY_ODDS_UPDATE, (payload) => {
            const mavo = typeof payload === "string" ? JSON.parse(payload) : payload;
            if (onOddsUpdateRef.current) onOddsUpdateRef.current(mavo);
        });

        return () => {
            s.close();
            setConnected(false);
        };
    }, [baseUrl, enabled]);

    return { connected };
}
