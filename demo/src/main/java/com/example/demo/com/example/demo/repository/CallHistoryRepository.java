package com.example.demo.repository;

import com.example.demo.model.CallHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CallHistoryRepository extends JpaRepository<CallHistory, Long> {
    // Returnează istoricul pentru un anumit utilizator
    List<CallHistory> findByUsernameOrderByJoinTimeDesc(String username);
}