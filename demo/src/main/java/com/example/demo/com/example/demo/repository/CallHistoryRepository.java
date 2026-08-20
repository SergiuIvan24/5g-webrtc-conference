package com.example.demo.repository;

import com.example.demo.model.CallHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CallHistoryRepository extends JpaRepository<CallHistory, Long> {
    List<CallHistory> findByUsernameOrderByJoinTimeDesc(String username);
}