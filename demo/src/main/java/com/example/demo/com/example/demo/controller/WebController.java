package com.example.demo.controller;

import com.example.demo.service.FreeSwitchService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
public class WebController {

    @Autowired
    private FreeSwitchService freeSwitchService;

    @GetMapping("/")
    public String home() {
        return "index";
    }

    @GetMapping("/room/{roomName}")
    public String joinRoom(@PathVariable String roomName, Model model) {
        model.addAttribute("roomName", roomName);
        return "room";
    }

    @GetMapping(value = "/api/participanti/{room}", produces = "application/json")
    @ResponseBody
    public List<Map<String, String>> getParticipanti(@PathVariable String room) {
        String rawOutput = freeSwitchService.getConferenceParticipants(room);
        List<Map<String, String>> participants = new ArrayList<>();

        System.out.println("Răspuns FS pentru camera " + room + ":\n" + rawOutput);

        if (rawOutput == null || rawOutput.trim().isEmpty()) {
            return participants;
        }

        String[] lines = rawOutput.split("\n");
        for (String line : lines) {
            if (line.contains(";") && !line.startsWith("+OK")) {
                String[] parts = line.split(";");
                if (parts.length >= 6) {
                    Map<String, String> pInfo = new HashMap<>();
                    pInfo.put("id", parts[0]);
                    pInfo.put("ext", parts[3]);
                    pInfo.put("channel", parts[1]);
                    pInfo.put("permissions", parts[5]);

                    String webName = null;
                    for (String part : parts) {
                        if (part.startsWith("WEB-")) {
                            webName = part;
                            break;
                        }
                    }
                    boolean hasVideo = webName != null;
                    pInfo.put("name", hasVideo ? webName.substring(4) : parts[3]);
                    pInfo.put("hasVideo", String.valueOf(hasVideo));

                    participants.add(pInfo);
                }
            }
        }
        return participants;
    }

    @PostMapping("/api/kick/{room}/{id}")
    @ResponseBody
    public String kickUser(@PathVariable String room, @PathVariable String id) {
        freeSwitchService.kickParticipant(room, id);
        return "{\"status\": \"kicked\"}";
    }

    @PostMapping("/api/mute/{room}/{id}")
    @ResponseBody
    public String muteUser(@PathVariable String room, @PathVariable String id) {
        freeSwitchService.toggleMuteParticipant(room, id);
        return "{\"status\": \"muted\"}";
    }
}