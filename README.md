# 5G WebRTC Conference Platform (VoNR/VoLTE Dispatcher)

This project represents an advanced telecommunications platform that bridges native 5G mobile networks with web interfaces using WebRTC technology. 

The primary goal of the application is to function as a high-performance dispatcher system (Command & Control). The platform enables bi-directional, ultra-low latency voice communication between field engineers or medical personnel (using 5G mobile terminals connected directly to the radio network) and base station operators (using a standard web browser).

Unlike standard OTT (Over-The-Top) applications, this solution integrates directly into the core of the mobile network (IMS / 5G Core), benefiting from the guaranteed QoS (Quality of Service) provided by the 5G Standalone standard.

## Main Features

* **Hybrid 5G-Web Calls:** Native support for VoNR (Voice over New Radio) and VoLTE, featuring real-time transcoding from the mobile codec (AMR) to the web codec (Opus).
* **Dynamic Conference Rooms:** Routing system that allows the creation and access of isolated virtual conference rooms (e.g., `/room/3000`).
* **Security and Authentication:** Account-based restricted access. Registration and login are protected by Spring Security, with passwords strongly encrypted (BCrypt) and stored in a database.
* **Live QoS (Quality of Service) Telemetry:** Real-time extraction and display of 5G/WebRTC network sensors directly on the call screen (Latency/RTT, Audio Jitter, Packet Loss, Active Codec).
* **Participant Management:** Live dashboard connected to the conference engine, enabling participant monitoring and moderation actions (Mute/Unmute, Kick).
* **Real-Time Text Chat:** WebSocket-based messaging system, automatically isolated for each specific conference room.
* **Call History:** Automated activity tracking and connection history display for each user on the main dashboard.

## System Architecture

The platform is built on a microservices architecture running in Docker containers, comprising the following key components:

1. **5G Core Network (Open5GS):** Manages the connectivity of antennas and mobile terminals (AMF, UPF, SMF, etc.).
2. **IMS Node (Kamailio):** Handles SIP signaling and call routing from the 5G network layer.
3. **Media Gateway (Asterisk):** Acts as a media converter, intercepting calls from the mobile network and resolving complex codec negotiations (specifically AMR transcoding).
4. **WebRTC Bridge & MCU (FreeSWITCH):** Functions as the main server for audio conferences and provides the secure bridge (DTLS/SRTP) to the web application.
5. **Web Backend (Java / Spring Boot):** 
   * Routes the frontend pages (Thymeleaf).
   * Manages the database (Spring Data JPA + MySQL).
   * Ensures platform security (Spring Security).
   * Communicates directly with FreeSWITCH via the ESL protocol to monitor and control live conferences.
6. **WebRTC Frontend (Vanilla JS + JsSIP):** The direct SIP client within the browser that connects to the backend and manages audio streams (without requiring any plugins).

## Technologies Used

* **Backend:** Java, Spring Boot (MVC, Security, Data JPA, WebSockets)
* **Frontend:** HTML5, CSS3, JavaScript, JsSIP
* **Database:** MySQL
* **Telecom & Network:** Kamailio, Asterisk, FreeSWITCH, Open5GS, Docker / Docker Compose
