const socket = new JsSIP.WebSocketInterface('ws://172.22.0.50:5066');

const configuration = {
    sockets: [ socket ],
    uri: 'sip:1001@172.22.0.50',
    password: '1234',
    session_timers: false,
    contact_uri: 'sip:1001@172.22.0.50;transport=ws'
};

JsSIP.debug.enable('JsSIP:*');

const ua = new JsSIP.UA(configuration);
let activeSession = null;

ua.start();

ua.on('connected', function () {
    document.getElementById('status').innerText = 'Status: Conectat la server. Gata de apel!';
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

function makeCall() {
    // Citim numărul introdus de utilizator, dacă e gol folosim 3000
    let roomNumber = document.getElementById('room-input').value;
    if (!roomNumber) {
        roomNumber = '3000';
    }

    // Construim destinația dinamic pe baza numărului citit
    const target = `sip:${roomNumber}@172.22.0.50`;
    const options = {
        mediaConstraints: { audio: true, video: false },
        // Setări obligatorii pentru compatibilitatea WebRTC (Ice/RTCP) cu FreeSWITCH
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

    activeSession.connection.addEventListener('iceconnectionstatechange', () => {
        console.log('ICE state:', activeSession.connection.iceConnectionState);
    });
    activeSession.connection.addEventListener('connectionstatechange', () => {
        console.log('Connection state:', activeSession.connection.connectionState);
    });

    // Aici prindem sunetul imediat ce conexiunea se deschide
    activeSession.connection.addEventListener('track', (e) => {
        console.log('Am primit fluxul audio!');
        const remoteAudio = document.getElementById('audio-remote');
        remoteAudio.srcObject = e.streams[0];

        // Forțăm redarea și prindem eventualele erori de la browser
        remoteAudio.play().catch(error => {
            console.error("Firefox blochează sunetul (Autoplay):", error);
        });
    });

    activeSession.on('progress', function () {
        document.getElementById('status').innerText = 'Status: Se sună...';
    });

    activeSession.on('confirmed', function () {
        document.getElementById('status').innerText = 'Status: Ești în conferință (' + roomNumber + ')!';
        document.getElementById('btn-call').disabled = true;
        document.getElementById('btn-hangup').disabled = false;
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
}

function resetUI() {
    document.getElementById('status').innerText = 'Status: Apel încheiat.';
    document.getElementById('btn-call').disabled = false;
    document.getElementById('btn-hangup').disabled = true;
}