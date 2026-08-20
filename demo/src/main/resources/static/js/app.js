let ua = null;
let activeSession = null;
let chatSocket = null;
let displayName = '';
let micMuted = false;
let qosInterval = null;
let prevBytesReceived = 0;
let prevTimestamp = 0;
const socket = new JsSIP.WebSocketInterface('ws://172.22.0.50:5066');

document.addEventListener('DOMContentLoaded', () => {
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

    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('conference-screen').style.display = 'block';

    if (typeof startDashboardUpdates === "function") {
        startDashboardUpdates();
    }

    initSipClient();

    fetch(`/api/history/save?username=${encodeURIComponent(displayName)}&room=${encodeURIComponent(currentRoomName)}`, {
        method: 'POST'
    }).then(() => console.log("Istoric salvat în DB!"))
        .catch(err => console.error("Eroare la salvarea istoricului:", err));
}

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
        makeCall();
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

function makeCall() {
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

function startQoSMonitor() {
    if (!activeSession || !activeSession.connection) return;

    qosInterval = setInterval(() => {
        activeSession.connection.getStats(null).then(stats => {
            let rtt = 0, jitter = 0, loss = 0;

            stats.forEach(report => {
                // Latență (RTT)
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    if (report.currentRoundTripTime !== undefined) {
                        rtt = report.currentRoundTripTime * 1000;
                        document.getElementById('qos-rtt').innerText = rtt.toFixed(1) + ' ms';
                    }
                }

                // Jitter, Pachete pierdute și BITRATE
                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                    if (report.jitter !== undefined) {
                        jitter = report.jitter * 1000;
                        document.getElementById('qos-jitter').innerText = jitter.toFixed(2) + ' ms';
                    }
                    if (report.packetsLost !== undefined) {
                        loss = report.packetsLost;
                        const elLoss = document.getElementById('qos-loss');
                        elLoss.innerText = loss;
                        elLoss.style.color = loss > 5 ? '#dc3545' : '#20c997'; // roșu dacă pierdem pachete, verde altfel
                    }

                    // Calcul Audio Bitrate
                    const now = report.timestamp;
                    const bytes = report.bytesReceived;
                    if (prevTimestamp && prevBytesReceived) {
                        const diffTime = now - prevTimestamp; // diferența de timp în ms
                        const diffBytes = bytes - prevBytesReceived; // diferența de octeți
                        if (diffTime > 0) {
                            const kbps = ((diffBytes * 8) / diffTime).toFixed(1);
                            const elBitrate = document.getElementById('qos-bitrate');
                            if(elBitrate) elBitrate.innerText = kbps + ' kbps';
                        }
                    }
                    prevBytesReceived = bytes;
                    prevTimestamp = now;
                }

                // Codec și SAMPLE RATE
                if (report.type === 'codec' && report.mimeType) {
                    if (report.mimeType.toLowerCase().includes('audio')) {
                        const codecName = report.mimeType.split('/')[1];
                        document.getElementById('qos-codec').innerText = codecName;

                        if (report.clockRate) {
                            const khz = (report.clockRate / 1000).toFixed(1);
                            const elSample = document.getElementById('qos-samplerate');
                            if(elSample) elSample.innerText = khz + ' kHz';
                        }
                    }
                }
            });

            // Calcul MOS (Mean Opinion Score) - Bonus pentru lucrare!
            // Formula estimativă bazată pe RTT și Jitter
            const elMos = document.getElementById('qos-mos');
            if (elMos && rtt >= 0) {
                let effectiveLatency = rtt + (jitter * 2) + 10;
                let rFactor = 93.2 - (effectiveLatency / 40);
                rFactor = rFactor - (loss * 2.5); // penalizăm pentru pachete pierdute

                let mos = 1.0;
                if (rFactor > 0) {
                    mos = 1 + (0.035 * rFactor) + (rFactor * (rFactor - 60) * (100 - rFactor) * 0.000007);
                }
                mos = Math.max(1, Math.min(mos, 5)); // Încadrăm între 1 și 5

                elMos.innerText = mos.toFixed(2);
                elMos.style.color = mos > 4.0 ? '#20c997' : (mos > 3.0 ? '#ffc107' : '#dc3545');
            }

        }).catch(err => console.error("Eroare citire telemetrie:", err));
    }, 1000);
}

function stopQoSMonitor() {
    if (qosInterval) {
        clearInterval(qosInterval);
        qosInterval = null;
    }
    prevBytesReceived = 0;
    prevTimestamp = 0;

    // Resetăm valorile pe UI
    const resetVal = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };

    resetVal('qos-rtt', '-- ms');
    resetVal('qos-jitter', '-- ms');
    resetVal('qos-loss', '0');
    resetVal('qos-codec', 'Detectare...');
    resetVal('qos-bitrate', '-- kbps');
    resetVal('qos-samplerate', '-- kHz');
    resetVal('qos-mos', '--');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}