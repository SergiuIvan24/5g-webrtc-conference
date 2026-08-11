package com.example.demo.controller;

import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // Afișează pagina de Login
    @GetMapping("/login")
    public String showLoginForm() {
        return "login";
    }

    // Afișează pagina de Înregistrare
    @GetMapping("/register")
    public String showRegisterForm() {
        return "register";
    }

    // Procesează datele când apeși "Creare Cont"
    @PostMapping("/register")
    public String registerUser(@RequestParam String username,
                               @RequestParam String password,
                               @RequestParam String displayName) {

        // Verificăm dacă user-ul există deja
        if (userRepository.findByUsername(username).isPresent()) {
            return "redirect:/register?error=exists";
        }

        // Creăm user-ul și îi criptăm parola
        User newUser = new User();
        newUser.setUsername(username);
        newUser.setDisplayName(displayName);
        newUser.setPassword(passwordEncoder.encode(password)); // NICIODATĂ nu salvăm parola în clar!

        userRepository.save(newUser); // Salvăm în MySQL

        return "redirect:/login?success=true"; // Îl trimitem la login
    }
}