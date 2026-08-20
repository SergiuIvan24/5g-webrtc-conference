package com.example.demo.controller;

import com.example.demo.model.CallHistory;
import com.example.demo.repository.CallHistoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/history")
public class HistoryController {

    @Autowired
    private CallHistoryRepository historyRepository;

    @PostMapping("/save")
    public String saveHistory(@RequestParam String username, @RequestParam String room) {
        CallHistory history = new CallHistory();
        history.setUsername(username);
        history.setRoomName(room);
        history.setJoinTime(LocalDateTime.now());

        historyRepository.save(history);
        return "Salvat cu succes!";
    }
    @DeleteMapping("/{username}")
    public String clearHistory(@PathVariable String username) {
        historyRepository.deleteAll(historyRepository.findByUsernameOrderByJoinTimeDesc(username));
        return "Istoricul a fost șters cu succes!";
    }
    @GetMapping("/{username}")
    public List<CallHistory> getHistory(@PathVariable String username) {
        return historyRepository.findByUsernameOrderByJoinTimeDesc(username);
    }
}