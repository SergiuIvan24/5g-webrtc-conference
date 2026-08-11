// ============================================================
// VARIABILE GLOBALE & LOBBY LOGIC
// ============================================================
let ua = null;
let activeSession = null;
let chatSocket = null;
let displayName = '';
let micMuted = false;
let qosInterval = null; // Stochează timer-ul pentru telemetrie
const socket = new JsSIP.WebSocketInterface('ws://172.22.0.50:5066');

document.addEventListener('DOMContentLoaded', () => {
    // Încărcăm numele anterior dacă există în localStorage
    const savedName = localStorage.getItem('demo-display-name');
    if (savedName) {
        document.getElementById('lobby-name').value = savedName;
    }

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
});

function joinFromLobby() {
    const inputName = document.getElementById('lobby-name').value.trim();
    if (!inputName) {
        alert('Te rugăm să introduci un nume pentru a intra în conferință!');
        return;
    }

    displayName = inputName;
    localStorage.setItem('demo-display-name', displayName);

    // Schimbăm vizibilitatea ecranelor
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('conference-screen').style.display = 'block';

    // Pornim dashboard-ul HTML (funcția din room.html)
    if (typeof startDashboardUpdates === "function") {
        startDashboardUpdates();
    }

    // Inițializăm clientul SIP
    initSipClient();
    // Trimitem informația către baza de date MySQL
    fetch(`/api/history/save?username=${encodeURIComponent(displayName)}&room=${encodeURIComponent(currentRoomName)}`, {
        method: 'POST'
    }).then(() => console.log("Istoric salvat în DB!"))
        .catch(err => console.error("Eroare la salvarea istoricului:", err));
}

// ============================================================
// CONFIGURARE SIP / JsSIP
// ============================================================
function initSipClient() {
    const sipDisplayName = 'WEB-' + displayName;
    const configuration = {
        sockets: [socket],
        uri: 'sip:1001@172.22.0.50',
        password: '1234',
        display_name: sipDisplayName,
        session_timers: false,
        contact_uri: 'sip:1001@172.22.0.50;transport=ws'
    };

    JsSIP.debug.enable('JsSIP:*');
    ua = new JsSIP.UA(configuration);

    ua.on('connected', function () {
        document.getElementById('status').innerText = 'Status: Conectat la server. Se inițiază apelul...';
        makeCall(); // Când s-a conectat la FreeSWITCH, sună automat
    });

    ua.on('disconnected', function () {
        document.getElementById('status').innerText = 'Status: Deconectat de la server.';
    });

    ua.on('registered', function () {
        console.log('Înregistrat cu succes.');
    });

    ua.on('registrationFailed', function (e) {
        console.error('Înregistrare eșuată:', e.cause);
        document.getElementById('status').innerText = 'Status: Înregistrare eșuată (' + e.cause + ')';
    });

    ua.start();
}

// ============================================================
// APEL (AUDIO)
// ============================================================
function makeCall() {
    // currentRoomName este definită global în room.html via Thymeleaf
    const target = `sip:${currentRoomName}@172.22.0.50`;
    const options = {
        mediaConstraints: { audio: true, video: false },
        pcConfig: {
            rtcpMuxPolicy: 'require',
            bundlePolicy: 'max-bundle'
        },
        rtcOfferConstraints: {
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
        }
    };

    activeSession = ua.call(target, options);

    activeSession.connection.addEventListener('track', (e) => {
        console.log('Am primit fluxul audio!');
        const remoteAudio = document.getElementById('audio-remote');
        remoteAudio.srcObject = e.streams[0];
        remoteAudio.play().catch(error => {
            console.error("Browserul blochează autoplay-ul:", error);
        });
    });

    activeSession.on('progress', function () {
        document.getElementById('status').innerText = 'Status: Se sună...';
    });

    activeSession.on('confirmed', function () {
        document.getElementById('status').innerText = 'Status: Conectat! Ești live în cameră.';
        connectChat(currentRoomName);
        startQoSMonitor();
    });

    activeSession.on('ended', function () {
        resetUI();
    });

    activeSession.on('failed', function (e) {
        resetUI();
        console.log('Detalii eșec:', e);
        alert('Apelul a eșuat: ' + e.cause);
    });
}

function hangUp() {
    if (activeSession) {
        activeSession.terminate();
    }
    disconnectChat();
    // Redirect înapoi la lobby (opțional)
    window.location.href = "/";
}

function toggleMic() {
    if (!activeSession) return;
    micMuted = !micMuted;
    activeSession.connection.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
            sender.track.enabled = !micMuted;
        }
    });

    const btnMute = document.getElementById('btn-mute');
    if (micMuted) {
        btnMute.innerText = '🔇 Unmute';
        btnMute.style.backgroundColor = '#dc3545';
    } else {
        btnMute.innerText = '🎙️ Mute';
        btnMute.style.backgroundColor = '#495057';
    }
}

function resetUI() {
    document.getElementById('status').innerText = 'Status: Apel încheiat.';
    document.getElementById('audio-remote').srcObject = null;
    if (typeof stopDashboardUpdates === "function") stopDashboardUpdates();
    stopQoSMonitor();
}

// ============================================================
// CHAT TEXT
// ============================================================
function connectChat(room) {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws/chat/${room}`;

    chatSocket = new WebSocket(wsUrl);

    chatSocket.onopen = () => {
        appendSystemMessage('Te-ai conectat la chat-ul camerei.');
    };

    chatSocket.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            appendChatMessage(msg.sender, msg.text, msg.sender === displayName);
        } catch (e) {
            console.error('Mesaj chat invalid:', event.data);
        }
    };

    chatSocket.onclose = () => {
        appendSystemMessage('Chat deconectat.');
    };
}

function disconnectChat() {
    if (chatSocket) {
        chatSocket.close();
        chatSocket = null;
    }
}

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !chatSocket || chatSocket.readyState !== WebSocket.OPEN) return;

    const payload = JSON.stringify({
        sender: displayName,
        text: text,
        ts: new Date().toISOString()
    });
    chatSocket.send(payload);
    input.value = '';
}

function appendChatMessage(sender, text, isOwn) {
    const container = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = 'chat-message' + (isOwn ? ' own' : '');
    const safeSender = escapeHtml(sender);
    const safeText = escapeHtml(text);
    el.innerHTML = `<span class="chat-sender">${safeSender}:</span> <span class="chat-text">${safeText}</span>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}

function appendSystemMessage(text) {
    const container = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = 'chat-message system';
    el.innerText = text;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}

// ============================================================
// MONITORIZARE TELEMETRIE (QoS 5G)
// ============================================================
function startQoSMonitor() {
    if (!activeSession || !activeSession.connection) return;

    // Citim senzorii rețelei o dată pe secundă
    qosInterval = setInterval(() => {
        activeSession.connection.getStats(null).then(stats => {
            stats.forEach(report => {

                // 1. Latența (Round Trip Time) din conexiunea candidatului activ
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    if (report.currentRoundTripTime !== undefined) {
                        const rtt = (report.currentRoundTripTime * 1000).toFixed(1);
                        document.getElementById('qos-rtt').innerText = rtt + ' ms';
                    }
                }

                // 2. Jitter și Pachete Pierdute (Pachete primite de la Kamailio/FreeSWITCH)
                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                    if (report.jitter !== undefined) {
                        const jitter = (report.jitter * 1000).toFixed(2);
                        document.getElementById('qos-jitter').innerText = jitter + ' ms';
                    }
                    if (report.packetsLost !== undefined) {
                        document.getElementById('qos-loss').innerText = report.packetsLost;

                        // Dacă pierdem pachete, facem textul roșu pentru avertizare
                        if(report.packetsLost > 5) {
                            document.getElementById('qos-loss').style.color = 'red';
                        }
                    }
                }

                // 3. Detectarea Codec-ului de voce negociat
                if (report.type === 'codec' && report.mimeType) {
                    // Căutăm doar codecurile audio (ex: audio/PCMU, audio/OPUS)
                    if (report.mimeType.toLowerCase().includes('audio')) {
                        const codecName = report.mimeType.split('/')[1];
                        document.getElementById('qos-codec').innerText = codecName;
                    }
                }
            });
        }).catch(err => console.error("Eroare citire telemetrie:", err));
    }, 1000);
}

function stopQoSMonitor() {
    if (qosInterval) {
        clearInterval(qosInterval);
        qosInterval = null;
    }
    // Resetăm afișajul
    document.getElementById('qos-rtt').innerText = '-- ms';
    document.getElementById('qos-jitter').innerText = '-- ms';
    document.getElementById('qos-loss').innerText = '0';
    document.getElementById('qos-codec').innerText = 'Detectare...';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}