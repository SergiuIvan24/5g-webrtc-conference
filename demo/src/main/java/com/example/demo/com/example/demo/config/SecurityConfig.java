package com.example.demo.config;

import com.example.demo.service.CustomUserDetailsService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    // Funcția care criptează parolele (să nu apară în clar în MySQL)
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Configurăm provider-ul care verifică parolele
    @Bean
    public DaoAuthenticationProvider authenticationProvider(CustomUserDetailsService userDetailsService) {
        // Punem userDetailsService direct in constructor!
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // Dezactivat doar pentru simplitate în laborator
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/register", "/css/**", "/js/**").permitAll() // La aceste pagini au voie toți (anonimi)
                        .anyRequest().authenticated() // Pentru ORICE altceva (inclusiv /room/3000), trebuie să fii logat!
                )
                .formLogin(form -> form
                        .loginPage("/login") // Pagina noastră custom de login
                        .defaultSuccessUrl("/", true) // Unde te trimite după ce bagi parola corectă
                        .permitAll()
                )
                .logout(logout -> logout
                        .logoutSuccessUrl("/")
                        .permitAll()
                );
        return http.build();
    }
}