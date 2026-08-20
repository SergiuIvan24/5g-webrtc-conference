package com.example.demo.service;

import org.freeswitch.esl.client.inbound.Client;
import org.freeswitch.esl.client.transport.message.EslMessage;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;

@Service
public class FreeSwitchService {

    private Client eslClient;

    @PostConstruct
    public void connectToFreeSwitch() {
        try {
            eslClient = new Client();
            eslClient.connect("172.22.0.50", 8021, "ClueCon", 10);

            eslClient.setEventSubscriptions("plain", "all");
            System.out.println("✅ CONECTAT CU SUCCES LA FREESWITCH ESL!");

        } catch (Exception e) {
            System.out.println("❌ EROARE LA CONECTAREA ESL: " + e.getMessage());
        }
    }

    private String getExactConferenceName(String roomNumber) {
        try {
            EslMessage response = eslClient.sendSyncApiCommand("conference", "list");
            if (response != null && !response.getBodyLines().isEmpty()) {
                for (String line : response.getBodyLines()) {
                    if (line.startsWith("+OK Conference " + roomNumber + "-") ||
                            line.startsWith("+OK Conference " + roomNumber + " ")) {
                        String[] parts = line.split(" ");
                        if (parts.length >= 3) {
                            return parts[2];
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.out.println("Eroare la găsirea numelui: " + e.getMessage());
        }
        return null;
    }

    public String getConferenceParticipants(String roomNumber) {
        String exactName = getExactConferenceName(roomNumber);
        if (exactName == null) return "";

        EslMessage response = eslClient.sendSyncApiCommand("conference", exactName + " list");
        if (response != null) {
            return String.join("\n", response.getBodyLines());
        }
        return "";
    }

    public void kickParticipant(String roomNumber, String memberId) {
        String exactName = getExactConferenceName(roomNumber);
        if (exactName != null) {
            eslClient.sendSyncApiCommand("conference", exactName + " kick " + memberId);
        }
    }

    public void toggleMuteParticipant(String roomNumber, String memberId) {
        String exactName = getExactConferenceName(roomNumber);
        if (exactName != null) {
            eslClient.sendSyncApiCommand("conference", exactName + " tmute " + memberId);
        }
    }
    private String getActiveConferenceName() {
        try {
            EslMessage response = eslClient.sendSyncApiCommand("conference", "list");
            if (response != null && !response.getBodyLines().isEmpty()) {
                String firstLine = response.getBodyLines().get(0);
                if (firstLine.startsWith("+OK Conference ")) {
                    String[] parts = firstLine.split(" ");
                    if (parts.length >= 3) {
                        return parts[2]; // Returnează ex: "3000-172.22.0.50"
                    }
                }
            }
        } catch (Exception e) {
            System.out.println("Eroare la găsirea numelui: " + e.getMessage());
        }
        return null;
    }

    public void kickParticipant(String memberId) {
        String confName = getActiveConferenceName();
        if (confName != null) {
            eslClient.sendSyncApiCommand("conference", confName + " kick " + memberId);
        }
    }

    public void toggleMuteParticipant(String memberId) {
        String confName = getActiveConferenceName();
        if (confName != null) {
            eslClient.sendSyncApiCommand("conference", confName + " tmute " + memberId);
        }
    }
}