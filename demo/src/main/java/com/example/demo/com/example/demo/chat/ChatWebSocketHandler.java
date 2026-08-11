package com.example.demo.chat;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Handler simplu de chat text, izolat pe camera de conferință.
 * Fiecare browser conectat la /ws/chat/{room} primește mesajele trimise
 * de ceilalți conectați la ACEEAȘI cameră (broadcast local, în memorie).
 *
 * Nu persistă mesajele - la restart de server, istoricul se pierde.
 * Pentru licență e suficient, dar dacă vrei istoric, vezi nota din
 * secțiunea "user system" de mai jos în răspuns.
 */
@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    // room -> lista de sesiuni conectate în camera respectivă
    private final Map<String, List<WebSocketSession>> rooms = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String room = extractRoom(session);
        rooms.computeIfAbsent(room, r -> new CopyOnWriteArrayList<>()).add(session);
        System.out.println("💬 Chat: sesiune nouă conectată la camera " + room);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String room = extractRoom(session);
        List<WebSocketSession> sessions = rooms.getOrDefault(room, List.of());

        // Broadcast simplu: retrimitem payload-ul (JSON: {sender, text, ts})
        // către toți cei conectați la aceeași cameră, inclusiv expeditorul
        // (așa apare mesajul propriu imediat, fără logică suplimentară pe client).
        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage(message.getPayload()));
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String room = extractRoom(session);
        List<WebSocketSession> sessions = rooms.get(room);
        if (sessions != null) {
            sessions.remove(session);
        }
    }

    private String extractRoom(WebSocketSession session) {
        // Path-ul e /ws/chat/{room}, extragem ultimul segment
        String path = session.getUri() != null ? session.getUri().getPath() : "";
        String[] parts = path.split("/");
        return parts.length > 0 ? parts[parts.length - 1] : "default";
    }
}