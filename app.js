const Constants = {
    SERVER_BASE_URL: 'wss://cw.438900.xyz',
    SCROLL_DELAY: 20,
    KNOB_DAMPING: 0.6,
    FREQUENCY_UPDATE_THROTTLE: 50,
    TIME_BROADCAST_BAND: '40m',
    TIME_BROADCAST_FREQUENCY: 7.003,
    SIGNAL_TIMEOUT: 3000,
  
    DOT_DURATION: 100,
    DASH_DURATION: 300,
    ELEMENT_GAP: 100,
    CHARACTER_GAP: 300,
    WORD_GAP: 700,
  
    BANDS: [
        { name: "160m", min: 1.800, max: 1.860, code: "160" },
        { name: "80m", min: 3.500, max: 3.525, code: "80" },
        { name: "40m", min: 7.000, max: 7.030, code: "40" },
        { name: "30m", min: 10.100, max: 10.140, code: "30" },
        { name: "20m", min: 14.000, max: 14.070, code: "20" },
        { name: "17m", min: 18.068, max: 18.100, code: "17" },
        { name: "15m", min: 21.000, max: 21.070, code: "15" },
        { name: "12m", min: 24.890, max: 24.930, code: "12" },
        { name: "10m", min: 28.000, max: 28.070, code: "10" },
        { name: "6m", min: 50.000, max: 50.100, code: "6" },
        { name: "2m", min: 144.000, max: 144.100, code: "2" },
        { name: "70cm", min: 430.000, max: 430.100, code: "70" }
    ],
  
    NETWORK: {
        RECONNECT_BACKOFF: 1000,
        MAX_RECONNECT_DELAY: 30000,
    },
  
    SIGNAL_PROCESSING: {
        FREQUENCY_TOLERANCE: 0.0001,
        TIME_SIGNAL_TOLERANCE: 0.0001,
        DECODE_CONFIDENCE_THRESHOLD: 0.7,
        RETRY_DECODE_ATTEMPTS: 3,
        CLIENT_TONE_VARIATION: 50,
        SIGNAL_MERGE_THRESHOLD: 0.001,
        SIGNAL_CONTINUITY_THRESHOLD: 50,
        SIGNAL_GAP_THRESHOLD: 500
    }
};

const MorseCodeMap = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
    '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
    '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
    '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
    '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
    '--..': 'Z', '-----': '0', '.----': '1', '..---': '2', '...--': '3',
    '....-': '4', '.....': '5', '-....': '6', '--...': '7', '---..': '8',
    '----.': '9', '/': ' ', '.-.-.-': '.', '--..--': ',', '---...': ':',
    '..--..': '?', '.----.': "'", '-....-': '-', '-..-.': '/', '-.--.': '(',
    '-.--.-': ')', '.-..-.': '"', '-...-': '=', '...-..-': '$', '.--.-.': '@'
};

const State = (() => {
    const state = {
        currentBandIndex: 2,
        previousBandIndex: 2,
        previousFrequency: 0,
        isManualMode: true,
        wpm: 20,
        keyer: {
            paddleDotPressed: false,
            paddleDashPressed: false,
            running: false,
            nextIsDot: true,
            loopTimer: null,
            gapTimer: null,
            dotPressedAt: 0,
            dashPressedAt: 0
        },
        isTransmitting: false,
        isMuted: false,
        isSearching: false,
        audioContext: null,
        oscillator: null,
        gainNode: null,
        masterGain: null,
        volume: 0.7,
        toneFrequency: 800,
        waterfallChart: null,
        frequencyKnobRotation: 0,
        volumeKnobRotation: 252,
        toneKnobRotation: 144,
        isDraggingFrequency: false,
        isDraggingVolume: false,
        isDraggingTone: false,
        startAngle: 0,
        ws: null,
        txWs: null,
        signalHistory: {},
        lastFrequencyUpdate: 0,
        signalBuffer: [],
        scrollInterval: null,
        lastSignalTime: 0,
        currentFrequency: 0,
        isReceivingTimeBroadcast: false,
        timeBroadcastBuffer: [],
        lastSignalTimestamp: 0,
        clientId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        transmitStartTime: null,
        activeRemoteSignals: {},
        transmitInterval: null,
        timeBroadcastTimeout: null,
        timeBroadcastDecodeTimeout: null,
        isDrawingTimeSignal: false,
        timeSignalDrawTimeout: null,
        lastActivityTime: 0,
        searchBandIndex: 0,
        searchTimeout: null,
        foundSignal: null,
        timeBroadcast: {
            lastSyncTime: 0,
            confidence: 0,
            lastValidTime: null
        }
    };

    function initSignalHistory() {
        Constants.BANDS.forEach(band => {
            state.signalHistory[band.name] = {};
        });
    }

    return {
        init: initSignalHistory,
        get: (key) => state[key],
        set: (key, value) => { state[key] = value; },
        update: (newState) => { Object.assign(state, newState); },
        getAll: () => ({ ...state })
    };
})();

const DOM = (() => {
    const elements = {};
  
    const elementIds = [
        'bandSelect', 'frequencyDigits', 'frequencyScale', 'waterfallCanvas',
        'frequencyKnob', 'volumeKnob', 'toneKnob', 'muteButton', 'morseKey',
        'connectionStatus', 'toneValue', 'searchButton', 'searchModal',
        'searchProgress', 'searchStatus', 'noSignalMessage', 'keyHintManual',
        'volumeValue', 'frequencyIndicator', 'timeBroadcastIndicator',
        'decodedTimeDisplay', 'audioActivationPrompt', 'testAudioButton', 'keyHintAuto',
        'modeToggle', 'wpmSlider', 'wpmGroup', 'modeLabel', 'wpmValue',
        'paddleKeyer'
    ];
  
    elementIds.forEach(id => {
        elements[id] = document.getElementById(id);
    });

    return {
        get: (id) => elements[id],
        updateText: (id, text) => { if (elements[id]) elements[id].textContent = text; },
        updateStyle: (id, prop, value) => { if (elements[id]) elements[id].style[prop] = value; },
        toggleClass: (id, className, add = true) => {
            if (elements[id]) {
                add ? elements[id].classList.add(className) : elements[id].classList.remove(className);
            }
        }
    };
})();

const Audio = (() => {
    function init() {
        if (State.get('audioContext')) return true;

        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext();

            const masterGain = audioContext.createGain();
            masterGain.gain.value = State.get('isMuted') ? 0 : 1;
            masterGain.connect(audioContext.destination);

            const gainNode = audioContext.createGain();
            gainNode.connect(masterGain);

            const oscillator = audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = State.get('toneFrequency');
            oscillator.connect(gainNode);
            oscillator.start();
            gainNode.gain.value = 0;

            State.update({ audioContext, masterGain, gainNode, oscillator });
            return true;
        } catch (error) {
            DOM.get('connectionStatus').innerHTML += ' <span class="audio-error">音频初始化失败</span>';
            return false;
        }
    }
    async function ensureContext() {
        if (!State.get('audioContext') && !init()) return false;
        const audioContext = State.get('audioContext');
        if (audioContext.state === 'suspended') {
            try { await audioContext.resume(); }
            catch (err) { return false; }
        }
        return true;
    }
    async function startTransmitting() {
        const state = State.getAll();
        if (state.isTransmitting || state.isMuted || state.isSearching) return false;
        State.set('transmitStartTime', Date.now());
        State.update({ isTransmitting: true });
        DOM.toggleClass('morseKey', 'key-press', true);
        const waterfall = State.get('waterfallChart');
        if (waterfall) waterfall.startSignal(State.get('currentFrequency'), true, false);
        Network.sendSignal();
        if (!State.get('transmitInterval')) {
            const interval = setInterval(() => {
                const waterfall = State.get('waterfallChart');
                if (State.get('isTransmitting') && waterfall) {
                    waterfall.drawContinuousSignal(State.get('currentFrequency'), true, false);
                }
            }, Constants.SCROLL_DELAY);
            State.set('transmitInterval', interval);
        }
        const ensured = await ensureContext();
        if (!ensured) {
            stopTransmitting();
            return false;
        }
        const { audioContext, gainNode } = State.getAll();
        const attackTime = 0.01;
        gainNode.gain.linearRampToValueAtTime(State.get('volume'), audioContext.currentTime + attackTime);
        const maxDurationTimer = setTimeout(() => {
            if (State.get('isTransmitting')) {
                stopTransmitting(true);
                startTransmitting();
            }
        }, 1000);
        State.set('maxDurationTimer', maxDurationTimer);
        return true;
    }
    function stopTransmitting(isTimeout = false) {
        if (!State.get('isTransmitting')) return;
        const interval = State.get('transmitInterval');
        if (interval) {
            clearInterval(interval);
            State.set('transmitInterval', null);
        }
        const gainNode = State.get('gainNode');
        const audioContext = State.get('audioContext');
        if (gainNode && audioContext) {
            const releaseTime = 0.01;
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + releaseTime);
        }
        State.set('isTransmitting', false);
        DOM.toggleClass('morseKey', 'key-press', false);
        const waterfall = State.get('waterfallChart');
        const start = State.get('transmitStartTime');
        if (waterfall && start) {
            waterfall.endSignal(State.get('currentFrequency'), true, false, Date.now() - start);
        }
        Network.sendSignal();
        State.set('transmitStartTime', null);
        const maxTimer = State.get('maxDurationTimer');
        if (maxTimer) {
            clearTimeout(maxTimer);
            State.set('maxDurationTimer', null);
        }
        if (isTimeout) {
            showReminder();
        }
    }
    function showReminder() {
        let reminder = document.getElementById('reminder');
        if (!reminder) {
            reminder = document.createElement('div');
            reminder.id = 'reminder';
            reminder.style.position = 'absolute';
            reminder.style.top = '50%';
            reminder.style.left = '50%';
            reminder.style.transform = 'translate(-50%, -50%)';
            reminder.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            reminder.style.color = 'white';
            reminder.style.padding = '10px';
            reminder.style.borderRadius = '5px';
            reminder.style.zIndex = '1000';
            reminder.style.fontSize = '14px';
            reminder.style.pointerEvents = 'none';
            const canvasContainer = document.querySelector('.waterfall-container') || document.body;
            canvasContainer.appendChild(reminder);
        }
        reminder.textContent = '请勿持续按压超过1秒';
        reminder.style.display = 'block';
        setTimeout(() => {
            reminder.style.display = 'none';
        }, 3000);
    }
    async function playReceivedTone(signalId) {
        if (!await ensureContext()) {
            DOM.toggleClass('audioActivationPrompt', 'hidden', false);
            return;
        }
        const signals = State.get('activeRemoteSignals');
        if (!signals[signalId]) return;
        if (signals[signalId].oscillator) return;
        const { audioContext, masterGain, toneFrequency } = State.getAll();
        const toneOffset = signals[signalId].toneOffset || 0;
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(toneFrequency + toneOffset, audioContext.currentTime);
        const gain = audioContext.createGain();
        const attackTime = 0.01;
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(State.get('volume') * 0.7, audioContext.currentTime + attackTime);
        gain.connect(masterGain);
        oscillator.connect(gain);
        oscillator.start();
        signals[signalId].oscillator = oscillator;
        signals[signalId].gainNode = gain;
        State.set('activeRemoteSignals', signals);
    }
    function stopReceivedTone(signalId) {
        const signals = State.get('activeRemoteSignals');
        if (!signals[signalId]) return;
        const oscillator = signals[signalId].oscillator;
        const gain = signals[signalId].gainNode;
        if (oscillator && gain) {
            const releaseTime = 0.01;
            gain.gain.setValueAtTime(gain.gain.value, State.get('audioContext').currentTime);
            gain.gain.linearRampToValueAtTime(0, State.get('audioContext').currentTime + releaseTime);
            setTimeout(() => {
                try {
                    oscillator.stop();
                    oscillator.disconnect();
                } catch (error) {}
                delete signals[signalId].oscillator;
                delete signals[signalId].gainNode;
                State.set('activeRemoteSignals', signals);
            }, releaseTime * 1000);
        }
    }
    async function playTimeBroadcastTone(type) {
        if (!await ensureContext()) {
            DOM.toggleClass('audioActivationPrompt', 'hidden', false);
            return;
        }
        const { audioContext, masterGain, toneFrequency } = State.getAll();
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(toneFrequency + 200, audioContext.currentTime);
        const gain = audioContext.createGain();
        const attackTime = 0.01;
        const releaseTime = 0.01;
        const duration = (type === 'dot' ? Constants.DOT_DURATION : Constants.DASH_DURATION) / 1000;
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(State.get('volume') * 0.8, audioContext.currentTime + attackTime);
        gain.gain.setValueAtTime(State.get('volume') * 0.8, audioContext.currentTime + attackTime);
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration - releaseTime);
        gain.connect(masterGain);
        oscillator.connect(gain);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    }
    async function playTestTone() {
        if (!await ensureContext()) {
            DOM.toggleClass('audioActivationPrompt', 'hidden', false);
            return false;
        }
        const { audioContext, masterGain } = State.getAll();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
        const attackTime = 0.01;
        const releaseTime = 0.01;
        const duration = 0.5;
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + attackTime);
        gain.gain.setValueAtTime(0.3, audioContext.currentTime + attackTime);
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration - releaseTime);
        oscillator.connect(gain);
        gain.connect(masterGain);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
        DOM.toggleClass('audioActivationPrompt', 'hidden', true);
        return true;
    }
    function toggleMute() {
        const isMuted = !State.get('isMuted');
        State.set('isMuted', isMuted);
        const masterGain = State.get('masterGain');
        if (masterGain) masterGain.gain.value = isMuted ? 0 : 1;
        const btn = DOM.get('muteButton');
        btn.innerHTML = isMuted ?
            '<i class="fa fa-volume-off mr-1"></i>静音' :
            '<i class="fa fa-volume-up mr-1"></i>静音';
        if (isMuted) stopTransmitting();
    }
    return {
        init, startTransmitting, stopTransmitting,
        playReceivedTone, stopReceivedTone, playTimeBroadcastTone,
        playTestTone, toggleMute
    };
})();
const Network = (() => {
    function initTxConnection(bandIndex) {
        const txWs = State.get('txWs');
        if (txWs) txWs.close(1000, '重新连接发送端');
        const bandCode = Constants.BANDS[bandIndex].code;
        const txUrl = `${Constants.SERVER_BASE_URL}/tx${bandCode}`;
        const newTxWs = new WebSocket(txUrl);
        newTxWs.onopen = () => {
            State.set('lastActivityTime', Date.now());
        };
        newTxWs.onclose = (event) => {
            if (event.code !== 1000) {
                const attempts = State.get('reconnectAttempts') || 0;
                const max = State.get('maxReconnectAttempts') || 5;
                if (attempts < max) {
                    const delay = Math.min(
                        Constants.NETWORK.RECONNECT_BACKOFF * Math.pow(2, attempts),
                        Constants.NETWORK.MAX_RECONNECT_DELAY
                    );
                    setTimeout(() => {
                        State.set('reconnectAttempts', attempts + 1);
                        initTxConnection(bandIndex);
                    }, delay);
                } else {
                    UI.updateConnectionStatus('发送连接已断开，无法重连');
                }
            }
        };
        newTxWs.onerror = () => UI.updateConnectionStatus('发送连接错误');
        newTxWs.onmessage = () => State.set('lastActivityTime', Date.now());
        newTxWs.onping = () => State.set('lastActivityTime', Date.now());
        State.set('txWs', newTxWs);
    }
    function connectToBand(bandIndex) {
        const ws = State.get('ws');
        if (ws) ws.close(1000, '切换波段');
        State.set('currentBandIndex', bandIndex);
        const band = Constants.BANDS[bandIndex];
        let currentFrequency = parseFloat(((band.min + band.max) / 2).toFixed(3));
        State.set('currentFrequency', currentFrequency);
        UI.resetFrequencyKnobRotation();
        UI.updateFrequencyDisplay();
        UI.updateFrequencyIndicatorPosition();
        UI.createFrequencyScale();
        UI.createWaterfallMarkers();
        UI.resetWaterfallPosition();
        const bandSelect = DOM.get('bandSelect');
        if (bandSelect) bandSelect.value = bandIndex;
        UI.updateConnectionStatus('<i class="fa fa-circle fa-spin"></i> 连接中...', 'status-connecting');
        const bandCode = Constants.BANDS[bandIndex].code;
        const wsUrl = `${Constants.SERVER_BASE_URL}/rx${bandCode}`;
        const newWs = new WebSocket(wsUrl);
        newWs.onopen = () => {
            UI.updateConnectionStatus(`<i class="fa fa-circle"></i> 已连接到 ${band.name}`, 'status-connected');
            initTxConnection(bandIndex);
            State.set('lastActivityTime', Date.now());
            if (State.get('isSearching')) {
                clearTimeout(State.get('searchTimeout'));
                const timeout = setTimeout(() => {
                    if (State.get('isSearching') && !State.get('foundSignal')) {
                        UI.updateSearchStatus(`未在 ${band.name} 发现信号，继续搜索...`);
                        UI.updateSearchProgress((bandIndex / Constants.BANDS.length) * 100);
                        UI.continueSearch();
                    }
                }, 3000);
                State.set('searchTimeout', timeout);
            }
        };
        newWs.onmessage = (event) => {
            State.set('lastActivityTime', Date.now());
            try {
                const signal = JSON.parse(event.data);
                SignalProcessor.handleIncomingSignal(signal);
                const isTimeBroadcast = Math.abs(signal.frequency - Constants.TIME_BROADCAST_FREQUENCY) <
                                      Constants.SIGNAL_PROCESSING.FREQUENCY_TOLERANCE;
                if (State.get('isSearching') && !State.get('foundSignal') &&
                    !isTimeBroadcast &&
                    (signal.type === 'start' || signal.type === 'dot' || signal.type === 'dash')) {
                    State.set('foundSignal', {
                        frequency: signal.frequency,
                        bandIndex: State.get('currentBandIndex')
                    });
                    UI.updateSearchStatus(`在 ${Constants.BANDS[State.get('currentBandIndex')].name} 发现信号！`);
                    UI.completeSearch();
                }
            } catch (error) {}
        };
        newWs.onclose = (event) => {
            UI.updateConnectionStatus(`<i class="fa fa-circle"></i> 连接断开 (${event.code})`, 'status-disconnected');
            const txWs = State.get('txWs');
            if (txWs) {
                txWs.close(1000, '接收连接已关闭');
                State.set('txWs', null);
            }
            if (event.code !== 1000) {
                const attempts = State.get('reconnectAttempts') || 0;
                const max = State.get('maxReconnectAttempts') || 5;
                if (attempts < max) {
                    const delay = Math.min(
                        Constants.NETWORK.RECONNECT_BACKOFF * Math.pow(2, attempts),
                        Constants.NETWORK.MAX_RECONNECT_DELAY
                    );
                    setTimeout(() => {
                        State.set('reconnectAttempts', attempts + 1);
                        connectToBand(bandIndex);
                    }, delay);
                } else {
                    UI.updateConnectionStatus('连接已断开，无法重连');
                    if (State.get('isSearching')) {
                        UI.updateSearchStatus(`连接 ${Constants.BANDS[bandIndex].name} 失败，继续搜索...`);
                        UI.continueSearch();
                    }
                }
            }
        };
        newWs.onerror = () => UI.updateConnectionStatus('连接错误');
        newWs.onping = () => State.set('lastActivityTime', Date.now());
        State.set('ws', newWs);
    }
    function sendSignal() {
        const txWs = State.get('txWs');
        if (!txWs || txWs.readyState !== WebSocket.OPEN) return;
        const isTransmitting = State.get('isTransmitting');
        const signalData = {
            frequency: State.get('currentFrequency'),
            clientId: State.get('clientId'),
            type: isTransmitting ? 'start' : 'end',
            timestamp: Date.now()
        };
        if (!isTransmitting && State.get('transmitStartTime')) {
            signalData.endTimestamp = Date.now();
            signalData.startTimestamp = State.get('transmitStartTime');
            signalData.duration = signalData.endTimestamp - signalData.startTimestamp;
        }
        try {
            txWs.send(JSON.stringify(signalData));
        } catch (error) {
            setTimeout(() => {
                const currentTxWs = State.get('txWs');
                if (currentTxWs && currentTxWs.readyState === WebSocket.OPEN) {
                    try { currentTxWs.send(JSON.stringify(signalData)); }
                    catch (retryError) {}
                }
            }, 300);
        }
    }
    function cleanupConnections() {
        const ws = State.get('ws');
        if (ws) ws.close(1000, '页面关闭');
        const txWs = State.get('txWs');
        if (txWs) txWs.close(1000, '页面关闭');
    }
    return { connectToBand, sendSignal, cleanupConnections };
})();
const SignalProcessor = (() => {
    function getToneOffsetForClient(clientId) {
        let hash = 0;
        for (let i = 0; i < clientId.length; i++) {
            const char = clientId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const range = Constants.SIGNAL_PROCESSING.CLIENT_TONE_VARIATION * 2;
        const offset = ((hash % range) + range) % range;
        return offset - Constants.SIGNAL_PROCESSING.CLIENT_TONE_VARIATION;
    }
    function findSimilarSignalId(frequency) {
        const tolerance = Constants.SIGNAL_PROCESSING.SIGNAL_MERGE_THRESHOLD;
        const now = Date.now();
        const signals = State.get('activeRemoteSignals');
        return Object.keys(signals).find(id => {
            const signal = signals[id];
            return Math.abs(signal.frequency - frequency) < tolerance &&
                   !signal.isTimeSignal &&
                   (now - signal.startTime) < (Constants.SIGNAL_TIMEOUT + Constants.SIGNAL_PROCESSING.SIGNAL_GAP_THRESHOLD);
        });
    }
    function handleIncomingSignal(signal) {
        if (typeof signal !== 'object' || typeof signal.frequency !== 'number' || !signal.type) return;
        const signalBand = Constants.BANDS.find(band =>
            signal.frequency >= band.min && signal.frequency <= band.max
        );
        const bandName = signalBand ? signalBand.name : Constants.BANDS[State.get('currentBandIndex')].name;
        const isLocal = signal.clientId === State.get('clientId');
        const isTimeBroadcastMarker = signal.type === 'marker';
        const isTimeBroadcastSignal = signal.type === 'dot' || signal.type === 'dash';
        const isTimeBroadcastGap = signal.type === 'gap';
        if (isLocal && (signal.type === 'start' || signal.type === 'end')) return;
        State.set('lastSignalTime', Date.now());
        if (bandName === Constants.TIME_BROADCAST_BAND &&
            Math.abs(signal.frequency - Constants.TIME_BROADCAST_FREQUENCY) < Constants.SIGNAL_PROCESSING.FREQUENCY_TOLERANCE) {
            DOM.toggleClass('timeBroadcastIndicator', 'hidden', false);
            clearTimeout(State.get('timeBroadcastTimeout'));
            const timeout = setTimeout(() => {
                if (!State.get('isReceivingTimeBroadcast')) {
                    DOM.toggleClass('timeBroadcastIndicator', 'hidden', true);
                }
            }, 10000);
            State.set('timeBroadcastTimeout', timeout);
            if (isTimeBroadcastMarker) {
                State.update({
                    isReceivingTimeBroadcast: true,
                    timeBroadcastBuffer: [],
                    lastSignalTimestamp: signal.timestamp
                });
                const timeBroadcast = State.get('timeBroadcast');
                timeBroadcast.decodingAttempts = 0;
                State.set('timeBroadcast', timeBroadcast);
                const waterfall = State.get('waterfallChart');
                if (waterfall) {
                    const signalId = `time-broadcast-${Date.now()}`;
                    waterfall.startSignal(Constants.TIME_BROADCAST_FREQUENCY, false, true, signalId);
                    const signals = State.get('activeRemoteSignals');
                    signals[signalId] = {
                        frequency: Constants.TIME_BROADCAST_FREQUENCY,
                        startTime: Date.now(),
                        isTimeSignal: true,
                        oscillator: null,
                        toneOffset: 200,
                        elementCount: 0,
                        waitingForFirstElement: true
                    };
                    State.set('activeRemoteSignals', signals);
                }
                return;
            } else if (isTimeBroadcastSignal) {
                const interval = signal.timestamp - State.get('lastSignalTimestamp');
                const buffer = State.get('timeBroadcastBuffer');
                buffer.push({ type: signal.type, interval, timestamp: signal.timestamp });
                State.set('timeBroadcastBuffer', buffer);
                State.set('lastSignalTimestamp', signal.timestamp);
                if (!State.get('isMuted') &&
                    Math.abs(signal.frequency - Constants.TIME_BROADCAST_FREQUENCY) < Constants.SIGNAL_PROCESSING.TIME_SIGNAL_TOLERANCE &&
                    Math.abs(State.get('currentFrequency') - Constants.TIME_BROADCAST_FREQUENCY) < Constants.SIGNAL_PROCESSING.TIME_SIGNAL_TOLERANCE) {
                    Audio.playTimeBroadcastTone(signal.type);
                }
                const duration = signal.duration || (signal.type === 'dot' ? Constants.DOT_DURATION : Constants.DASH_DURATION);
                State.set('isDrawingTimeSignal', true);
                clearTimeout(State.get('timeSignalDrawTimeout'));
                const timeout = setTimeout(() => {
                    State.set('isDrawingTimeSignal', false);
                }, duration);
                State.set('timeSignalDrawTimeout', timeout);
            } else if (isTimeBroadcastGap) {
                const timeoutDelay = isTimeBroadcastMarker ? 1000 :
                                    (isTimeBroadcastSignal ? 500 :
                                    (State.get('timeBroadcastBuffer').length > 3 ? 3000 : 2000));
                clearTimeout(State.get('timeBroadcastDecodeTimeout'));
                const timeout = setTimeout(() => {
                    attemptDecodeWithRetry(0);
                    State.set('isReceivingTimeBroadcast', false);
                    const waterfall = State.get('waterfallChart');
                    if (waterfall) {
                        const signals = State.get('activeRemoteSignals');
                        const timeSignalId = Object.keys(signals).find(id => id.startsWith('time-broadcast-'));
                        if (timeSignalId) {
                            const signal = signals[timeSignalId];
                            const duration = Date.now() - signal.startTime;
                            waterfall.endSignal(Constants.TIME_BROADCAST_FREQUENCY, false, true, duration, false);
                            const removeDelay = Math.max(5000, signal.elementCount * 800);
                            setTimeout(() => {
                                const sigs = State.get('activeRemoteSignals');
                                delete sigs[timeSignalId];
                                State.set('activeRemoteSignals', sigs);
                            }, removeDelay);
                        }
                    }
                }, timeoutDelay);
                State.set('timeBroadcastDecodeTimeout', timeout);
            }
        } else if (!isTimeBroadcastGap) {
            const freqKey = signal.frequency.toFixed(3);
            const history = State.get('signalHistory');
            if (!history[bandName]) history[bandName] = {};
            if (!history[bandName][freqKey]) {
                history[bandName][freqKey] = { timestamp: Date.now(), count: 1 };
            } else {
                history[bandName][freqKey].timestamp = Date.now();
                history[bandName][freqKey].count = Math.min(history[bandName][freqKey].count + 1, 100);
            }
            State.set('signalHistory', history);
            const waterfall = State.get('waterfallChart');
            if (waterfall) {
                const isTimeSignal = bandName === Constants.TIME_BROADCAST_BAND &&
                                   Math.abs(signal.frequency - Constants.TIME_BROADCAST_FREQUENCY) < Constants.SIGNAL_PROCESSING.FREQUENCY_TOLERANCE;
                let duration;
                if (signal.endTimestamp && signal.startTimestamp) {
                    duration = signal.endTimestamp - signal.startTimestamp;
                } else {
                    duration = signal.type === 'start' ? 100 : 0;
                }
                if (signal.type === 'start') {
                    let signalId = findSimilarSignalId(signal.frequency);
                    const now = Date.now();
                    if (signalId) {
                        const signals = State.get('activeRemoteSignals');
                        const existing = signals[signalId];
                        const timeSinceLast = now - existing.lastUpdateTime;
                        if (timeSinceLast > Constants.SIGNAL_PROCESSING.SIGNAL_CONTINUITY_THRESHOLD) {
                            waterfall.markSignalGap(existing.frequency, existing.isLocal, existing.isTimeSignal,
                                                  Math.round(timeSinceLast / Constants.SCROLL_DELAY));
                            Audio.stopReceivedTone(signalId);
                            if (existing.renderInterval) clearInterval(existing.renderInterval);
                            if (existing.timeout) clearTimeout(existing.timeout);
                            signalId = null;
                        } else {
                            existing.lastUpdateTime = signal.timestamp;
                            State.set('activeRemoteSignals', signals);
                            if (!State.get('isMuted')) Audio.playReceivedTone(signalId);
                            return;
                        }
                    }
                    if (!signalId) {
                        signalId = `${signal.frequency.toFixed(3)}-${signal.timestamp}`;
                        const toneOffset = signal.clientId ? getToneOffsetForClient(signal.clientId) : 0;
                        const isDotSignal = signal.duration && signal.duration < 200;
                        const signals = State.get('activeRemoteSignals');
                        signals[signalId] = {
                            frequency: signal.frequency,
                            startTime: signal.timestamp,
                            lastUpdateTime: signal.timestamp,
                            isTimeSignal,
                            oscillator: null,
                            toneOffset,
                            isLocal,
                            isDot: isDotSignal,
                            timeout: null,
                            renderInterval: null
                        };
                        State.set('activeRemoteSignals', signals);
                        waterfall.startSignal(signal.frequency, isLocal, isTimeSignal, signalId);
                    } else {
                        const signals = State.get('activeRemoteSignals');
                        signals[signalId].lastUpdateTime = signal.timestamp;
                        State.set('activeRemoteSignals', signals);
                    }
                    const band = Constants.BANDS[State.get('currentBandIndex')];
                    const bandWidth = band.max - band.min;
                    const tolerance = bandWidth * 0.01;
                    if (!State.get('isMuted') && Math.abs(signal.frequency - State.get('currentFrequency')) < tolerance) {
                        const signals = State.get('activeRemoteSignals');
                        if (!signals[signalId].oscillator) {
                            Audio.playReceivedTone(signalId);
                        }
                    }
                    const signals = State.get('activeRemoteSignals');
                    if (!signals[signalId].renderInterval) {
                        const intervalId = setInterval(() => {
                            const sigs = State.get('activeRemoteSignals');
                            if (!sigs[signalId]) {
                                clearInterval(intervalId);
                                return;
                            }
                            waterfall.drawContinuousSignal(
                                sigs[signalId].frequency,
                                sigs[signalId].isLocal,
                                sigs[signalId].isTimeSignal
                            );
                        }, Constants.SCROLL_DELAY / 2);
                        signals[signalId].renderInterval = intervalId;
                        State.set('activeRemoteSignals', signals);
                    }
                    signals[signalId].timeout = setTimeout(() => {
                        const activeSignals = State.get('activeRemoteSignals');
                        if (activeSignals[signalId]) {
                            const sig = activeSignals[signalId];
                            const endTime = Date.now();
                            const duration = endTime - sig.startTime;
                            waterfall.endSignal(sig.frequency, sig.isLocal, sig.isTimeSignal, duration, true);
                            Audio.stopReceivedTone(signalId);
                            if (sig.renderInterval) clearInterval(sig.renderInterval);
                            delete activeSignals[signalId];
                            State.set('activeRemoteSignals', activeSignals);
                        }
                    }, 1000);
                    State.set('activeRemoteSignals', signals);
                } else if (signal.type === 'end') {
                    const signalKey = findSimilarSignalId(signal.frequency) ||
                                     `${signal.frequency.toFixed(3)}-${signal.startTimestamp}`;
                    const signals = State.get('activeRemoteSignals');
                    if (signals[signalKey]) {
                        duration = signal.endTimestamp - signal.startTimestamp;
                        if (signals[signalKey].timeout) {
                            clearTimeout(signals[signalKey].timeout);
                        }
                        if (signals[signalKey].renderInterval) {
                            clearInterval(signals[signalKey].renderInterval);
                        }
                        waterfall.endSignal(signal.frequency, isLocal, isTimeSignal, duration);
                        Audio.stopReceivedTone(signalKey);
                        delete signals[signalKey];
                        State.set('activeRemoteSignals', signals);
                    }
                }
            }
        }
    }
    function attemptDecodeWithRetry(attempt) {
        if (attempt >= Constants.SIGNAL_PROCESSING.RETRY_DECODE_ATTEMPTS) {
            finalizeTimeBroadcastDecode();
            return;
        }
        const result = decodeTimeBroadcastWithConfidence();
        if (result.confidence >= Constants.SIGNAL_PROCESSING.DECODE_CONFIDENCE_THRESHOLD) {
            const timeBroadcast = State.get('timeBroadcast');
            timeBroadcast.confidence = result.confidence;
            timeBroadcast.lastValidTime = result.text;
            State.set('timeBroadcast', timeBroadcast);
            finalizeTimeBroadcastDecode();
            return;
        }
        setTimeout(() => attemptDecodeWithRetry(attempt + 1), 300);
    }
    function decodeTimeBroadcastWithConfidence() {
        const buffer = State.get('timeBroadcastBuffer');
        if (buffer.length === 0) return { text: '', confidence: 0 };
        const morseElements = [];
        let currentCode = '';
        let unknownCount = 0;
        buffer.forEach((item, index) => {
            if (item.type === 'dot' || item.type === 'dash') {
                currentCode += item.type === 'dot' ? '.' : '-';
            }
            const nextItem = buffer[index + 1];
            if (nextItem) {
                const normalizedInterval = nextItem.interval / Constants.DOT_DURATION;
                if (normalizedInterval > 3) {
                    if (currentCode) {
                        morseElements.push(currentCode);
                        if (!MorseCodeMap[currentCode]) unknownCount++;
                        currentCode = '';
                    }
                    if (normalizedInterval > 7) {
                        morseElements.push('/');
                    }
                }
            } else {
                if (currentCode) {
                    morseElements.push(currentCode);
                    if (!MorseCodeMap[currentCode]) unknownCount++;
                }
            }
        });
        let decodedText = '';
        morseElements.forEach(code => {
            decodedText += MorseCodeMap[code] || '?';
        });
        const totalElements = morseElements.filter(code => code !== '/').length;
        const confidence = totalElements > 0 ? 1 - (unknownCount / totalElements) : 0;
        return { text: decodedText, confidence };
    }
    function finalizeTimeBroadcastDecode() {
        const timeBroadcast = State.get('timeBroadcast');
        const buffer = State.get('timeBroadcastBuffer');
        if (!timeBroadcast.lastValidTime && buffer.length > 0) {
            const rawMorse = buffer
                .filter(item => item.type === 'dot' || item.type === 'dash')
                .map(item => item.type === 'dot' ? '.' : '-')
                .join(' ');
            timeBroadcast.lastValidTime = `原始码: ${rawMorse}`;
            timeBroadcast.confidence = 0;
        }
        const display = DOM.get('decodedTimeDisplay');
        if (display && timeBroadcast.lastValidTime) {
            let text = `时间广播: ${timeBroadcast.lastValidTime}`;
            if (timeBroadcast.confidence > 0) {
                text += ` (可信度: ${(timeBroadcast.confidence * 100).toFixed(0)}%)`;
            }
            display.textContent = text;
            DOM.toggleClass('decodedTimeDisplay', 'hidden', false);
            display.className = 'decoded-time';
            if (timeBroadcast.confidence >= 0.7) {
                display.classList.add('high-confidence');
            } else if (timeBroadcast.confidence >= 0.3) {
                display.classList.add('medium-confidence');
            } else {
                display.classList.add('low-confidence');
            }
            setTimeout(() => DOM.toggleClass('decodedTimeDisplay', 'hidden', true), 15000);
        }
        timeBroadcast.lastSyncTime = Date.now();
        State.set('timeBroadcast', timeBroadcast);
    }
    function cleanupAndCheckTimeouts() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const history = State.get('signalHistory');
        Object.keys(history).forEach(band => {
            Object.keys(history[band]).forEach(freq => {
                if (history[band][freq].timestamp < oneMinuteAgo) {
                    delete history[band][freq];
                }
            });
        });
        State.set('signalHistory', history);
        const signals = State.get('activeRemoteSignals');
        Object.keys(signals).forEach(id => {
            const signal = signals[id];
            const timeout = signal.isTimeSignal ?
                         (signal.elementCount > 3 ? 10000 : 7000) :
                         Constants.SIGNAL_TIMEOUT;
            if (now - signal.startTime > timeout) {
                const endTime = Date.now();
                const duration = endTime - signal.startTime;
                const waterfall = State.get('waterfallChart');
                if (waterfall) {
                    waterfall.endSignal(signal.frequency, false, signal.isTimeSignal, duration, true);
                }
                Audio.stopReceivedTone(id);
                if (signal.renderInterval) clearInterval(signal.renderInterval);
                if (signal.timeout) clearTimeout(signal.timeout);
                delete signals[id];
                State.set('activeRemoteSignals', signals);
            }
        });
        const ws = State.get('ws');
        if (ws && State.get('lastActivityTime') && now - State.get('lastActivityTime') > 300000) {
            ws.close(1000, '长时间无活动');
        }
    }
    return { handleIncomingSignal, cleanupAndCheckTimeouts };
})();
const Waterfall = (() => {
    function init() {
        const canvas = DOM.get('waterfallCanvas');
        if (!canvas) return;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const activeSignals = {};
        let dirtyRegions = [];
        const waterfall = {
            ctx,
            width: canvas.width,
            height: canvas.height,
            scrollOffset: 0,
            activeSignals,
            visibleRange: { start: 0, end: 1 },
            dirtyRegions,
            initBuffer: function() {
                let buffer = [];
                for (let y = 0; y < this.height; y++) {
                    buffer[y] = new Uint8Array(this.width).fill(0);
                }
                State.set('signalBuffer', buffer);
                Object.keys(activeSignals).forEach(key => delete activeSignals[key]);
                this.dirtyRegions = [];
            },
            addDirtyRegion: function(x, y, width = 1, height = 1) {
                this.dirtyRegions.push({x, y, width, height});
            },
            mergeDirtyRegions: function() {
                if (this.dirtyRegions.length <= 1) return;
                const merged = [this.dirtyRegions[0]];
                for (let i = 1; i < this.dirtyRegions.length; i++) {
                    const current = this.dirtyRegions[i];
                    let mergedIndex = -1;
                    for (let j = 0; j < merged.length; j++) {
                        const m = merged[j];
                        if (current.x < m.x + m.width &&
                            current.x + current.width > m.x &&
                            current.y < m.y + m.height &&
                            current.y + current.height > m.y) {
                            mergedIndex = j;
                            break;
                        }
                    }
                    if (mergedIndex !== -1) {
                        const m = merged[mergedIndex];
                        merged[mergedIndex] = {
                            x: Math.min(m.x, current.x),
                            y: Math.min(m.y, current.y),
                            width: Math.max(m.x + m.width, current.x + current.width) - Math.min(m.x, current.x),
                            height: Math.max(m.y + m.height, current.y + current.height) - Math.min(m.y, current.y)
                        };
                    } else {
                        merged.push(current);
                    }
                }
                this.dirtyRegions = merged;
            },
            startSignal: function(frequency, isLocal = false, isTimeSignal = false, signalId = null) {
                const band = Constants.BANDS[State.get('currentBandIndex')];
                const range = band.max - band.min;
                const position = Math.round((frequency - band.min) / range * this.width);
                if (position < 0 || position >= this.width) return;
                const id = signalId || `${frequency.toFixed(3)}-${Date.now()}`;
                activeSignals[id] = {
                    position,
                    isLocal,
                    isTimeSignal,
                    startTime: Date.now(),
                    spread: 2,
                    lastDrawnRow: this.height - 1
                };
                const row = this.height - 1;
                const buffer = State.get('signalBuffer');
                buffer[row][position] = isTimeSignal ? 4 : (isLocal ? 3 : 2);
                for (let j = 1; j <= 2; j++) {
                    if (position - j >= 0) buffer[row][position - j] = isTimeSignal ? 4 : (isLocal ? 3 : 2);
                    if (position + j < this.width) buffer[row][position + j] = isTimeSignal ? 4 : (isLocal ? 3 : 2);
                }
                State.set('signalBuffer', buffer);
                this.addDirtyRegion(position - 2, row, 5, 1);
            },
            markSignalGap: function(frequency, isLocal = false, isTimeSignal = false, gapLength) {
                const band = Constants.BANDS[State.get('currentBandIndex')];
                const range = band.max - band.min;
                const position = Math.round((frequency - band.min) / range * this.width);
                if (position < 0 || position >= this.width) return;
                const buffer = State.get('signalBuffer');
                for (let i = 0; i < gapLength; i++) {
                    const row = Math.max(0, this.height - 1 - i);
                    if (!isTimeSignal) {
                        buffer[row][position] = 0;
                        for (let j = 1; j <= 2; j++) {
                            if (position - j >= 0) buffer[row][position - j] = 0;
                            if (position + j < this.width) buffer[row][position + j] = 0;
                        }
                    }
                    this.addDirtyRegion(position - 2, row, 5, 1);
                }
                State.set('signalBuffer', buffer);
            },
            drawContinuousSignal: function(frequency, isLocal = false, isTimeSignal = false) {
                const band = Constants.BANDS[State.get('currentBandIndex')];
                const range = band.max - band.min;
                const position = Math.round((frequency - band.min) / range * this.width);
                if (position < 0 || position >= this.width) return;
                const strength = isTimeSignal ? 4 : (isLocal ? 3 : 2);
                const row = this.height - 1;
                const buffer = State.get('signalBuffer');
                buffer[row][position] = strength;
                for (let j = 1; j <= 2; j++) {
                    if (position - j >= 0) buffer[row][position - j] = strength;
                    if (position + j < this.width) buffer[row][position + j] = strength;
                }
                State.set('signalBuffer', buffer);
                this.addDirtyRegion(position - 2, row, 5, 1);
            },
            endSignal: function(frequency, isLocal = false, isTimeSignal = false, duration, isTimeout = false) {
                const signalKey = `${frequency.toFixed(3)}-`;
                Object.keys(activeSignals).forEach(key => {
                    if (key.startsWith(signalKey)) {
                        if (activeSignals[key].renderInterval) {
                            clearInterval(activeSignals[key].renderInterval);
                        }
                        if (!isTimeSignal) {
                            delete activeSignals[key];
                        } else {
                            setTimeout(() => delete activeSignals[key], 8000);
                        }
                    }
                });
            },
            scrollUp: function() {
                let buffer = State.get('signalBuffer');
                buffer.shift();
                buffer.push(new Uint8Array(this.width).fill(0));
                if (State.get('isDrawingTimeSignal')) {
                    const band = Constants.BANDS[State.get('currentBandIndex')];
                    const range = band.max - band.min;
                    const position = Math.round((Constants.TIME_BROADCAST_FREQUENCY - band.min) / range * this.width);
                    if (position >= 0 && position < this.width) {
                        const row = this.height - 1;
                        const strength = 4;
                        buffer[row][position] = strength;
                        for (let j = 1; j <= 2; j++) {
                            if (position - j >= 0) buffer[row][position - j] = strength;
                            if (position + j < this.width) buffer[row][position + j] = strength;
                        }
                        this.addDirtyRegion(position - 2, row, 5, 1);
                    }
                }
                State.set('signalBuffer', buffer);
                this.dirtyRegions = [{x: 0, y: 0, width: this.width, height: this.height}];
                Object.values(activeSignals).forEach(signal => {
                    const currentRow = this.height - 1;
                    const rowDiff = signal.lastDrawnRow - currentRow;
                    if (rowDiff > 0) {
                        const buffer = State.get('signalBuffer');
                        buffer[currentRow][signal.position] = signal.isTimeSignal ? 4 : (signal.isLocal ? 3 : 2);
                        for (let j = 1; j <= signal.spread; j++) {
                            if (signal.position - j >= 0) buffer[currentRow][signal.position - j] = signal.isTimeSignal ? 4 : (signal.isLocal ? 3 : 2);
                            if (signal.position + j < this.width) buffer[currentRow][signal.position + j] = signal.isTimeSignal ? 4 : (signal.isLocal ? 3 : 2);
                        }
                        State.set('signalBuffer', buffer);
                        signal.lastDrawnRow = currentRow;
                    }
                });
            },
            update: function() {
                if (!this.ctx) return;
                if (this.dirtyRegions.length === 0) {
                    requestAnimationFrame(() => this.update());
                    return;
                }
                this.mergeDirtyRegions();
                this.dirtyRegions.forEach(region => {
                    this.ctx.save();
                    this.ctx.beginPath();
                    this.ctx.rect(region.x, region.y, region.width, region.height);
                    this.ctx.clip();
                    this.ctx.fillStyle = '#050a1a';
                    this.ctx.fillRect(region.x, region.y, region.width, region.height);
                    this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
                    this.ctx.lineWidth = 1;
                    for (let y = Math.floor(region.y / 40) * 40; y < region.y + region.height; y += 40) {
                        if (y >= this.height) break;
                        this.ctx.beginPath();
                        this.ctx.moveTo(region.x, y);
                        this.ctx.lineTo(Math.min(region.x + region.width, this.width), y);
                        this.ctx.stroke();
                    }
                    for (let x = Math.floor(region.x / 80) * 80; x < region.x + region.width; x += 80) {
                        if (x >= this.width) break;
                        this.ctx.beginPath();
                        this.ctx.moveTo(x, region.y);
                        this.ctx.lineTo(x, Math.min(region.y + region.height, this.height));
                        this.ctx.stroke();
                    }
                    const buffer = State.get('signalBuffer');
                    for (let y = region.y; y < region.y + region.height && y < this.height; y++) {
                        const age = (this.height - y) / this.height;
                        for (let x = region.x; x < region.x + region.width && x < this.width; x++) {
                            const strength = buffer[y][x];
                            if (strength > 1) {
                                let color, alpha;
                                if (strength === 2) {
                                    alpha = 1 - (age * 0.7);
                                    color = `rgba(0, 255, 0, ${alpha})`;
                                } else if (strength === 3) {
                                    alpha = 1 - (age * 0.7);
                                    color = `rgba(255, 215, 0, ${alpha})`;
                                } else if (strength === 4) {
                                    alpha = 1 - (age * 0.4);
                                    color = `rgba(255, 165, 0, ${alpha})`;
                                }
                                this.ctx.fillStyle = color;
                                this.ctx.fillRect(x, y, 1, 1);
                            }
                        }
                    }
                    this.ctx.restore();
                });
                this.dirtyRegions = [];
                requestAnimationFrame(() => this.update());
            }
        };
        waterfall.initBuffer();
        const scrollInterval = setInterval(() => waterfall.scrollUp(), Constants.SCROLL_DELAY);
        State.set('scrollInterval', scrollInterval);
        State.set('waterfallChart', waterfall);
        waterfall.update();
    }
    return { init };
})();
const UI = (() => {
    function updateConnectionStatus(message, className = 'status-disconnected') {
        const el = DOM.get('connectionStatus');
        if (el) {
            el.className = className;
            el.innerHTML = message;
        }
    }
    function populateBandSelect() {
        const select = DOM.get('bandSelect');
        if (!select) return;
        select.innerHTML = '';
        Constants.BANDS.forEach((band, index) => {
            const option = document.createElement('option');
            option.value = index;
            const label = band.name === Constants.TIME_BROADCAST_BAND
                ? `${band.name} (${band.min} - ${band.max} MHz) - 含时间与ISS坐标`
                : `${band.name} (${band.min} - ${band.max} MHz)`;
            option.textContent = label;
            if (index === State.get('currentBandIndex')) option.selected = true;
            select.appendChild(option);
        });
    }
    function resetFrequencyKnobRotation() {
        const band = Constants.BANDS[State.get('currentBandIndex')];
        const range = band.max - band.min;
        const percentage = (State.get('currentFrequency') - band.min) / range;
        const rotation = percentage * 360;
        State.set('frequencyKnobRotation', rotation);
        setKnobRotation('frequencyKnob', rotation);
    }
    function createWaterfallMarkers() {
        const container = document.querySelector('.waterfall-markers');
        const canvas = DOM.get('waterfallCanvas');
        if (!container || !canvas) return;
        container.innerHTML = '';
        container.style.paddingLeft = '10px';
        container.style.paddingRight = '10px';
        container.style.overflow = 'hidden';
        container.style.width = `${canvas.offsetWidth}px`;
        const band = Constants.BANDS[State.get('currentBandIndex')];
        const range = band.max - band.min;
        const step = range / 6;
        for (let i = 0; i <= 6; i++) {
            const freq = band.min + (step * i);
            const marker = document.createElement('div');
            marker.className = 'waterfall-marker';
            marker.style.position = 'absolute';
            marker.style.left = `${(i / 6) * 100}%`;
            marker.style.top = '5px';
            marker.style.color = 'rgba(0, 255, 0, 0.7)';
            marker.style.fontSize = '12px';
            marker.style.textShadow = '0 0 3px rgba(0, 255, 0, 0.8)';
            marker.style.transform = 'translateX(-50%)';
            marker.style.whiteSpace = 'nowrap';
            marker.textContent = freq.toFixed(3) + ' MHz';
            container.appendChild(marker);
        }
        if (band.name === Constants.TIME_BROADCAST_BAND) {
            const marker = document.createElement('div');
            marker.className = 'waterfall-marker time-broadcast';
            marker.style.position = 'absolute';
            const timeFreq = Constants.TIME_BROADCAST_FREQUENCY;
            const percentage = (timeFreq - band.min) / range * 100;
            marker.style.left = `${percentage}%`;
            marker.style.top = '25px';
            marker.style.color = 'rgba(255, 165, 0, 0.9)';
            marker.style.fontSize = '12px';
            marker.style.fontWeight = 'bold';
            marker.style.textShadow = '0 0 3px rgba(255, 165, 0, 0.8)';
            marker.style.transform = 'translateX(-50%)';
            marker.style.whiteSpace = 'nowrap';
            marker.textContent = `${timeFreq} MHz (TIME&ISS)`;
            marker.style.animation = 'pulse 2s infinite';
            container.appendChild(marker);
        }
    }
    function updateFrequencyIndicatorPosition() {
        const band = Constants.BANDS[State.get('currentBandIndex')];
        const range = band.max - band.min;
        const percentage = (State.get('currentFrequency') - band.min) / range;
        DOM.updateStyle('frequencyIndicator', 'left', `${percentage * 100}%`);
        DOM.updateStyle('frequencyIndicator', 'zIndex', '100');
        updateFrequencyScalePosition(percentage);
    }
    function resetWaterfallPosition() {
        const waterfall = State.get('waterfallChart');
        if (waterfall) {
            waterfall.scrollOffset = 0;
            waterfall.visibleRange = { start: 0, end: 1 };
            updateFrequencyScalePosition(0);
        }
    }
    function scrollWaterfall(percentage) {
        const waterfall = State.get('waterfallChart');
        if (!waterfall) return;
        const visibleWidth = 0.7;
        let start = percentage * (1 - visibleWidth);
        start = Math.max(0, Math.min(1 - visibleWidth, start));
        waterfall.visibleRange = { start, end: start + visibleWidth };
        updateFrequencyScalePosition(percentage);
    }
    function updateFrequencyScalePosition(percentage) {
        const scale = DOM.get('frequencyScale');
        const canvas = DOM.get('waterfallCanvas');
        if (!scale || !canvas) return;
        DOM.updateStyle('frequencyScale', 'width', `${canvas.offsetWidth}px`);
        DOM.updateStyle('frequencyScale', 'transform', `translateX(0px)`);
    }
    function createFrequencyScale() {
        const scale = DOM.get('frequencyScale');
        const canvas = DOM.get('waterfallCanvas');
        if (!scale || !canvas) return;
        scale.innerHTML = '';
        const band = Constants.BANDS[State.get('currentBandIndex')];
        const range = band.max - band.min;
        const stepSize = Math.max(0.005, range / 20);
        const totalWidth = canvas.offsetWidth;
        DOM.updateStyle('frequencyScale', 'width', `${totalWidth}px`);
        for (let freq = band.min; freq <= band.max; freq += stepSize) {
            const roundedFreq = parseFloat(freq.toFixed(3));
            const marker = document.createElement('div');
            marker.className = 'scale-marker';
            if (band.name === Constants.TIME_BROADCAST_BAND &&
                Math.abs(roundedFreq - Constants.TIME_BROADCAST_FREQUENCY) < Constants.SIGNAL_PROCESSING.FREQUENCY_TOLERANCE) {
                marker.classList.add('time-broadcast-marker');
                marker.style.animation = 'pulse 2s infinite';
            }
            const percentage = (roundedFreq - band.min) / range * 100;
            marker.style.left = `${percentage}%`;
            marker.style.position = 'absolute';
            marker.style.top = '5px';
            marker.style.color = 'rgba(0, 255, 0, 0.7)';
            marker.style.fontSize = '12px';
            marker.style.textShadow = '0 0 3px rgba(0, 255, 0, 0.8)';
            marker.style.transform = 'translateX(-50%)';
            marker.style.whiteSpace = 'nowrap';
            const label = document.createElement('span');
            label.textContent = roundedFreq.toFixed(3);
            marker.appendChild(label);
            scale.appendChild(marker);
        }
    }
    function setKnobRotation(knobName, degrees) {
        const knob = DOM.get(knobName);
        if (knob) knob.style.transform = `rotate(${degrees}deg)`;
    }
    function updateFrequencyDisplay() {
        DOM.updateText('frequencyDigits', `${State.get('currentFrequency').toFixed(3)} MHz`);
    }
    function updateToneDisplay() {
        DOM.updateText('toneValue', `${State.get('toneFrequency')} Hz`);
    }
    function updateVolumeDisplay() {
        const percentage = Math.round(State.get('volume') * 100);
        DOM.updateText('volumeValue', `${percentage}%`);
    }
    function updateSearchStatus(message) {
        DOM.updateText('searchStatus', message);
    }
    function updateSearchProgress(percentage) {
        DOM.updateStyle('searchProgress', 'width', `${percentage}%`);
    }
    function continueSearch() {
        let nextBandIndex = State.get('searchBandIndex') + 1;
        if (nextBandIndex >= Constants.BANDS.length) {
            completeSearch();
            return;
        }
        State.set('searchBandIndex', nextBandIndex);
        updateSearchStatus(`正在扫描 ${Constants.BANDS[nextBandIndex].name} 波段...`);
        updateSearchProgress((nextBandIndex / Constants.BANDS.length) * 100);
        Network.connectToBand(nextBandIndex);
    }
    function searchForSignals() {
        if (State.get('isSearching')) return;
        State.set('previousBandIndex', State.get('currentBandIndex'));
        State.set('previousFrequency', State.get('currentFrequency'));
        State.set('isSearching', true);
        State.set('searchBandIndex', 0);
        State.set('foundSignal', null);
        const searchBtn = DOM.get('searchButton');
        if (searchBtn) {
            searchBtn.disabled = true;
        }
        const modal = DOM.get('searchModal');
        if (modal) {
            modal.style.display = 'flex';
            updateSearchStatus(`开始扫描 ${Constants.BANDS[0].name} 波段...`);
            updateSearchProgress(0);
            setTimeout(() => modal.classList.add('show'), 10);
        }
        Network.connectToBand(0);
    }
    function completeSearch() {
        if (!State.get('isSearching')) return;
        setTimeout(() => {
            const foundSignal = State.get('foundSignal');
            if (foundSignal) {
                State.set('currentBandIndex', foundSignal.bandIndex);
                State.set('currentFrequency', foundSignal.frequency);
                updateFrequencyDisplay();
                updateFrequencyIndicatorPosition();
                resetFrequencyKnobRotation();
                updateSearchStatus(`已切换到 ${Constants.BANDS[foundSignal.bandIndex].name} 的信号频率`);
            } else {
                const prevBandIndex = State.get('previousBandIndex');
                const prevFrequency = State.get('previousFrequency');
                State.set('currentBandIndex', prevBandIndex);
                State.set('currentFrequency', prevFrequency);
                updateFrequencyDisplay();
                updateFrequencyIndicatorPosition();
                resetFrequencyKnobRotation();
                Network.connectToBand(prevBandIndex);
                updateSearchStatus('未找到任何信号，已恢复到原始频率');
                DOM.toggleClass('noSignalMessage', 'hidden', false);
            }
            setTimeout(() => {
                const modal = DOM.get('searchModal');
                if (modal) {
                    modal.classList.remove('show');
                    setTimeout(() => {
                        modal.style.display = 'none';
                        const searchBtn = DOM.get('searchButton');
                        if (searchBtn) {
                            searchBtn.disabled = false;
                        }
                        State.set('isSearching', false);
                        State.set('foundSignal', null);
                    }, 300);
                }
            }, 2000);
        }, 500);
    }
    function updateFrequencyFromInput(e, isTouch = false) {
        if (State.get('isTransmitting')) return;
        const knob = DOM.get('frequencyKnob');
        if (!knob) return;
        const rect = knob.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;
        const mouseX = clientX - rect.left - centerX;
        const mouseY = clientY - rect.top - centerY;
        let currentAngle = Math.atan2(mouseY, mouseX) * (180 / Math.PI);
        currentAngle = (currentAngle + 360) % 360;
        currentAngle = (currentAngle + 90) % 360;
        let angleDiff = currentAngle - State.get('startAngle');
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;
        let rotation = State.get('frequencyKnobRotation') + angleDiff * Constants.KNOB_DAMPING;
        State.set('frequencyKnobRotation', rotation);
        setKnobRotation('frequencyKnob', rotation);
        const band = Constants.BANDS[State.get('currentBandIndex')];
        const range = band.max - band.min;
        const positionInRange = ((rotation % 360) + 360) % 360 / 360;
        let newFrequency = band.min + (positionInRange * range);
        newFrequency = parseFloat(newFrequency.toFixed(3));
        const now = Date.now();
        if (now - State.get('lastFrequencyUpdate') > Constants.FREQUENCY_UPDATE_THROTTLE ||
            Math.abs(newFrequency - State.get('currentFrequency')) > 0.002) {
            State.set('currentFrequency', newFrequency);
            updateFrequencyDisplay();
            State.set('lastFrequencyUpdate', now);
        }
        updateFrequencyIndicatorPosition();
        State.set('startAngle', currentAngle);
    }
    function updateVolumeFromInput(e, isTouch = false) {
        const knob = DOM.get('volumeKnob');
        if (!knob) return;
        const rect = knob.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;
        const mouseX = clientX - rect.left - centerX;
        const mouseY = clientY - rect.top - centerY;
        let currentAngle = Math.atan2(mouseY, mouseX) * (180 / Math.PI);
        currentAngle = (currentAngle + 360) % 360;
        currentAngle = (currentAngle + 90) % 360;
        let angleDiff = currentAngle - State.get('startAngle');
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;
        let rotation = State.get('volumeKnobRotation') + angleDiff * Constants.KNOB_DAMPING;
        State.set('volumeKnobRotation', rotation);
        setKnobRotation('volumeKnob', rotation);
        const normalizedRotation = ((rotation % 360) + 360) % 360;
        const volume = normalizedRotation / 360;
        State.set('volume', volume);
        const gainNode = State.get('gainNode');
        const audioContext = State.get('audioContext');
        if (gainNode && audioContext) {
            if (State.get('isTransmitting')) {
                gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
            } else {
                gainNode.gain.value = 0;
            }
        }
        updateVolumeDisplay();
        State.set('startAngle', currentAngle);
    }
    function updateToneFromInput(e, isTouch = false) {
        const knob = DOM.get('toneKnob');
        if (!knob) return;
        const rect = knob.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;
        const mouseX = clientX - rect.left - centerX;
        const mouseY = clientY - rect.top - centerY;
        let currentAngle = Math.atan2(mouseY, mouseX) * (180 / Math.PI);
        currentAngle = (currentAngle + 360) % 360;
        currentAngle = (currentAngle + 90) % 360;
        let angleDiff = currentAngle - State.get('startAngle');
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;
        let rotation = State.get('toneKnobRotation') + angleDiff * Constants.KNOB_DAMPING;
        State.set('toneKnobRotation', rotation);
        setKnobRotation('toneKnob', rotation);
        const normalizedRotation = ((rotation % 360) + 360) % 360;
        const toneFrequency = 400 + (normalizedRotation / 360) * 800;
        State.set('toneFrequency', Math.round(toneFrequency));
        const oscillator = State.get('oscillator');
        const audioContext = State.get('audioContext');
        if (oscillator && audioContext) {
            oscillator.frequency.linearRampToValueAtTime(State.get('toneFrequency'), audioContext.currentTime + 0.01);
        }
        updateToneDisplay();
        State.set('startAngle', currentAngle);
    }
    function setupEventListeners() {
        document.body.focus();
        const bandSelect = DOM.get('bandSelect');
        if (bandSelect) {
            bandSelect.addEventListener('change', (e) => {
                const newIndex = parseInt(e.target.value);
                if (newIndex !== State.get('currentBandIndex')) {
                    Network.connectToBand(newIndex);
                }
            });
        }
        const freqKnob = DOM.get('frequencyKnob');
        if (freqKnob) {
            freqKnob.addEventListener('mousedown', (e) => {
                if (State.get('isSearching') || State.get('isTransmitting')) return;
                State.set('isDraggingFrequency', true);
                const rect = freqKnob.getBoundingClientRect();
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const mouseX = e.clientX - rect.left - centerX;
                const mouseY = e.clientY - rect.top - centerY;
                let startAngle = Math.atan2(mouseY, mouseX) * (180 / Math.PI);
                startAngle = (startAngle + 360) % 360;
                startAngle = (startAngle + 90) % 360;
                State.set('startAngle', startAngle);
            });
            freqKnob.addEventListener('touchstart', (e) => {
                if (State.get('isSearching') || State.get('isTransmitting') || e.touches.length !== 1) return;
                e.preventDefault();
                State.set('isDraggingFrequency', true);
                const rect = freqKnob.getBoundingClientRect();
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const touchX = e.touches[0].clientX - rect.left - centerX;
                const touchY = e.touches[0].clientY - rect.top - centerY;
                let startAngle = Math.atan2(touchY, touchX) * (180 / Math.PI);
                startAngle = (startAngle + 360) % 360;
                startAngle = (startAngle + 90) % 360;
                State.set('startAngle', startAngle);
            }, { passive: false });
        }
        const volKnob = DOM.get('volumeKnob');
        if (volKnob) {
            volKnob.addEventListener('mousedown', (e) => {
                State.set('isDraggingVolume', true);
                const rect = volKnob.getBoundingClientRect();
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const mouseX = e.clientX - rect.left - centerX;
                const mouseY = e.clientY - rect.top - centerY;
                let startAngle = Math.atan2(mouseY, mouseX) * (180 / Math.PI);
                startAngle = (startAngle + 360) % 360;
                startAngle = (startAngle + 90) % 360;
                State.set('startAngle', startAngle);
            });
            volKnob.addEventListener('touchstart', (e) => {
                if (e.touches.length !== 1) return;
                e.preventDefault();
                State.set('isDraggingVolume', true);
                const rect = volKnob.getBoundingClientRect();
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const touchX = e.touches[0].clientX - rect.left - centerX;
                const touchY = e.touches[0].clientY - rect.top - centerY;
                let startAngle = Math.atan2(touchY, touchX) * (180 / Math.PI);
                startAngle = (startAngle + 360) % 360;
                startAngle = (startAngle + 90) % 360;
                State.set('startAngle', startAngle);
            }, { passive: false });
        }
 
        const toneKnob = DOM.get('toneKnob');
        if (toneKnob) {
            toneKnob.addEventListener('mousedown', (e) => {
                State.set('isDraggingTone', true);
                const rect = toneKnob.getBoundingClientRect();
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const mouseX = e.clientX - rect.left - centerX;
                const mouseY = e.clientY - rect.top - centerY;
         
                let startAngle = Math.atan2(mouseY, mouseX) * (180 / Math.PI);
                startAngle = (startAngle + 360) % 360;
                startAngle = (startAngle + 90) % 360;
                State.set('startAngle', startAngle);
            });
      
            toneKnob.addEventListener('touchstart', (e) => {
                if (e.touches.length !== 1) return;
                e.preventDefault();
          
                State.set('isDraggingTone', true);
                const rect = toneKnob.getBoundingClientRect();
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const touchX = e.touches[0].clientX - rect.left - centerX;
                const touchY = e.touches[0].clientY - rect.top - centerY;
          
                let startAngle = Math.atan2(touchY, touchX) * (180 / Math.PI);
                startAngle = (startAngle + 360) % 360;
                startAngle = (startAngle + 90) % 360;
                State.set('startAngle', startAngle);
            }, { passive: false });
        }
 
        document.addEventListener('mousemove', (e) => {
            if (State.get('isDraggingFrequency')) {
                updateFrequencyFromInput(e);
            } else if (State.get('isDraggingVolume')) {
                updateVolumeFromInput(e);
            } else if (State.get('isDraggingTone')) {
                updateToneFromInput(e);
            }
        });
 
        document.addEventListener('touchmove', (e) => {
            if (State.get('isDraggingFrequency')) {
                e.preventDefault();
                updateFrequencyFromInput(e, true);
            } else if (State.get('isDraggingVolume')) {
                e.preventDefault();
                updateVolumeFromInput(e, true);
            } else if (State.get('isDraggingTone')) {
                e.preventDefault();
                updateToneFromInput(e, true);
            }
        }, { passive: false });
 
        document.addEventListener('mouseup', () => {
            State.update({
                isDraggingFrequency: false,
                isDraggingVolume: false,
                isDraggingTone: false
            });
        });
 
        document.addEventListener('touchend', () => {
            State.update({
                isDraggingFrequency: false,
                isDraggingVolume: false,
                isDraggingTone: false
            });
        });
 
        document.addEventListener('touchcancel', () => {
            State.update({
                isDraggingFrequency: false,
                isDraggingVolume: false,
                isDraggingTone: false
            });
        });
  
        document.addEventListener('mouseleave', () => {
            State.update({
                isDraggingFrequency: false,
                isDraggingVolume: false,
                isDraggingTone: false
            });
        });
 
        const canvas = DOM.get('waterfallCanvas');
        if (canvas) {
            canvas.addEventListener('click', (e) => {
                if (State.get('isSearching') || State.get('isTransmitting')) return;
         
                const rect = canvas.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percentage = clickX / rect.width;
         
                const band = Constants.BANDS[State.get('currentBandIndex')];
                const range = band.max - band.min;
                const visibleRange = State.get('waterfallChart')?.visibleRange || { start: 0, end: 1 };
                const visibleWidth = visibleRange.end - visibleRange.start;
                const adjustedPercentage = visibleRange.start + (percentage * visibleWidth);
         
                const newFrequency = parseFloat((band.min + (adjustedPercentage * range)).toFixed(3));
         
                State.set('currentFrequency', newFrequency);
                updateFrequencyDisplay();
                updateFrequencyIndicatorPosition();
                resetFrequencyKnobRotation();
            });
        }
 
        const muteBtn = DOM.get('muteButton');
        if (muteBtn) {
            muteBtn.addEventListener('click', Audio.toggleMute);
        }
 
        const testBtn = DOM.get('testAudioButton');
        if (testBtn) {
            testBtn.addEventListener('click', Audio.playTestTone);
        }
 
        const morseKey = DOM.get('morseKey');
        if (morseKey) {
            morseKey.addEventListener('contextmenu', (e) => { e.preventDefault(); });
            morseKey.addEventListener('mousedown', (e) => {
                if (State.get('isMuted') || State.get('isSearching')) return;
                if (State.get('isManualMode')) {
                    Audio.startTransmitting();
                    return;
                }
                if (e.button === 0) {
                    Keyer.setPaddle('dot', true);
                } else if (e.button === 2) {
                    Keyer.setPaddle('dash', true);
                }
            });
     
            morseKey.addEventListener('mouseup', (e) => {
                if (State.get('isManualMode')) {
                    if (State.get('isTransmitting')) Audio.stopTransmitting();
                    return;
                }
                if (e.button === 0) {
                    Keyer.setPaddle('dot', false);
                } else if (e.button === 2) {
                    Keyer.setPaddle('dash', false);
                }
            });
     
            morseKey.addEventListener('mouseleave', () => {
                if (State.get('isTransmitting')) {
                    Audio.stopTransmitting();
                }
            });
            morseKey.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (State.get('isMuted') || State.get('isSearching')) return;
                if (State.get('isManualMode')) {
                    Audio.startTransmitting();
                } else {
                    Keyer.setPaddle('dot', true);
                }
            }, { passive: false });
      
            morseKey.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (State.get('isManualMode')) {
                    if (State.get('isTransmitting')) Audio.stopTransmitting();
                } else {
                    Keyer.setPaddle('dot', false);
                }
            }, { passive: false });
      
            morseKey.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                if (State.get('isTransmitting')) {
                    Audio.stopTransmitting();
                }
            }, { passive: false });
        }
 
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && State.get('isManualMode') && !State.get('isMuted') && !State.get('isSearching') && !State.get('isTransmitting')) {
                e.preventDefault();
                Audio.startTransmitting();
            }
            if (!State.get('isManualMode')) {
                if (e.key === ',') {
                    e.preventDefault();
                    Keyer.setPaddle('dot', true);
                } else if (e.key === '.') {
                    e.preventDefault();
                    Keyer.setPaddle('dash', true);
                } else if (e.code === 'ArrowLeft') {
                    e.preventDefault();
                    Keyer.setPaddle('dot', true);
                } else if (e.code === 'ArrowRight') {
                    e.preventDefault();
                    Keyer.setPaddle('dash', true);
                }
            }
     
            if (e.code === 'KeyT' && Constants.BANDS[State.get('currentBandIndex')].name === Constants.TIME_BROADCAST_BAND && !State.get('isTransmitting')) {
                e.preventDefault();
                State.set('currentFrequency', Constants.TIME_BROADCAST_FREQUENCY);
                updateFrequencyDisplay();
                updateFrequencyIndicatorPosition();
                resetFrequencyKnobRotation();
            }
     
            if (e.code === 'KeyA') {
                e.preventDefault();
                Audio.playTestTone();
            }
        });
 
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space' && State.get('isManualMode')) {
                e.preventDefault();
                if (State.get('isTransmitting')) Audio.stopTransmitting();
            }
            if (!State.get('isManualMode')) {
                if (e.key === ',') {
                    e.preventDefault();
                    Keyer.setPaddle('dot', false);
                } else if (e.key === '.') {
                    e.preventDefault();
                    Keyer.setPaddle('dash', false);
                } else if (e.code === 'ArrowLeft') {
                    e.preventDefault();
                    Keyer.setPaddle('dot', false);
                } else if (e.code === 'ArrowRight') {
                    e.preventDefault();
                    Keyer.setPaddle('dash', false);
                }
            }
        });
 
        const searchBtn = DOM.get('searchButton');
        if (searchBtn) {
            searchBtn.addEventListener('click', searchForSignals);
        }
 
        window.addEventListener('resize', () => {
            const canvas = DOM.get('waterfallCanvas');
            if (canvas) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                const waterfall = State.get('waterfallChart');
                if (waterfall) {
                    waterfall.width = canvas.width;
                    waterfall.height = canvas.height;
                    waterfall.initBuffer();
                }
                UI.createFrequencyScale();
                UI.createWaterfallMarkers();
                UI.updateFrequencyIndicatorPosition();
            }
        });
 
        window.addEventListener('beforeunload', () => {
            Network.cleanupConnections();
      
            const scrollInterval = State.get('scrollInterval');
            if (scrollInterval) clearInterval(scrollInterval);
       
            const transmitInterval = State.get('transmitInterval');
            if (transmitInterval) clearInterval(transmitInterval);
      
            Audio.stopTransmitting();
      
            const signals = State.get('activeRemoteSignals');
            Object.keys(signals).forEach(id => {
                if (signals[id].renderInterval) clearInterval(signals[id].renderInterval);
                Audio.stopReceivedTone(id);
            });
            Keyer.stop();
        });
        const modeToggle = DOM.get('modeToggle');
        const wpmSlider = DOM.get('wpmSlider');
        const wpmGroup = DOM.get('wpmGroup');
        const modeLabel = DOM.get('modeLabel');
        const wpmValue = DOM.get('wpmValue');
        if (modeToggle && wpmSlider && wpmGroup && modeLabel && wpmValue) {
            modeToggle.addEventListener('change', () => {
                const manual = !modeToggle.checked;
                State.set('isManualMode', manual);
                DOM.toggleClass('wpmGroup', 'hidden', manual);
                DOM.toggleClass('keyHintManual', 'hidden', !manual);
                DOM.toggleClass('keyHintAuto', 'hidden', manual);
                DOM.toggleClass('morseKey', 'hidden', !manual);
                DOM.toggleClass('paddleKeyer', 'hidden', manual);
                modeLabel.textContent = manual ? '手动' : '自动键';
                if (manual) Keyer.stop();
            });
            wpmSlider.addEventListener('input', () => {
                const val = parseInt(wpmSlider.value);
                State.set('wpm', val);
                wpmValue.textContent = String(val);
            });
        }
        const paddleLeft = document.getElementById('paddleLeft');
        const paddleRight = document.getElementById('paddleRight');
        const paddleArea = document.getElementById('paddleArea');
        if (paddleLeft && paddleRight && paddleArea) {
            const setVisual = (leftOn, rightOn) => {
                if (leftOn) paddleLeft.classList.add('active'); else paddleLeft.classList.remove('active');
                if (rightOn) paddleRight.classList.add('active'); else paddleRight.classList.remove('active');
            };
            paddleArea.addEventListener('contextmenu', (e) => { e.preventDefault(); });
            let mouseEngaged = false;
            const updateFromButtons = (buttons) => {
                if (State.get('isManualMode')) return;
                const leftOn = (buttons & 1) === 1;
                const rightOn = (buttons & 2) === 2;
                Keyer.setPaddle('dot', leftOn);
                Keyer.setPaddle('dash', rightOn);
                setVisual(leftOn, rightOn);
            };
            paddleArea.addEventListener('mousedown', (e) => {
                if (State.get('isManualMode')) return;
                e.preventDefault();
                mouseEngaged = true;
                updateFromButtons(e.buttons);
            });
            document.addEventListener('mousemove', (e) => {
                if (!mouseEngaged) return;
                updateFromButtons(e.buttons);
            });
            document.addEventListener('mouseup', (e) => {
                if (!mouseEngaged) return;
                updateFromButtons(e.buttons);
                if ((e.buttons & 3) === 0) {
                    mouseEngaged = false;
                    setVisual(false, false);
                }
            });
            if (paddleLeft) {
                paddleLeft.addEventListener('touchstart', (e) => {
                    if (State.get('isManualMode')) return;
                    e.preventDefault();
                    Keyer.setPaddle('dot', true);
                    setVisual(true, false);
                }, { passive: false });
                paddleLeft.addEventListener('touchend', (e) => {
                    if (State.get('isManualMode')) return;
                    e.preventDefault();
                    Keyer.setPaddle('dot', false);
                    setVisual(false, false);
                }, { passive: false });
                paddleLeft.addEventListener('touchcancel', (e) => {
                    if (State.get('isManualMode')) return;
                    e.preventDefault();
                    Keyer.setPaddle('dot', false);
                    setVisual(false, false);
                }, { passive: false });
            }
            if (paddleRight) {
                paddleRight.addEventListener('touchstart', (e) => {
                    if (State.get('isManualMode')) return;
                    e.preventDefault();
                    Keyer.setPaddle('dash', true);
                    setVisual(false, true);
                }, { passive: false });
                paddleRight.addEventListener('touchend', (e) => {
                    if (State.get('isManualMode')) return;
                    e.preventDefault();
                    Keyer.setPaddle('dash', false);
                    setVisual(false, false);
                }, { passive: false });
                paddleRight.addEventListener('touchcancel', (e) => {
                    if (State.get('isManualMode')) return;
                    e.preventDefault();
                    Keyer.setPaddle('dash', false);
                    setVisual(false, false);
                }, { passive: false });
            }
        }
    }
    return {
        updateConnectionStatus, populateBandSelect, resetFrequencyKnobRotation,
        createWaterfallMarkers, updateFrequencyIndicatorPosition,
        resetWaterfallPosition, createFrequencyScale, updateFrequencyDisplay,
        updateToneDisplay, updateVolumeDisplay, setupEventListeners,
        updateSearchStatus, updateSearchProgress, continueSearch, completeSearch
    };
})();
function init() {
    State.init();
 
    UI.populateBandSelect();
    UI.setupEventListeners();
    Keyer.init();
 
    Waterfall.init();

    Network.connectToBand(State.get('currentBandIndex'));
 
    setInterval(SignalProcessor.cleanupAndCheckTimeouts, 1000);
}
window.addEventListener('load', init);
const Keyer = (() => {
    function msPerDit() {
        const wpm = State.get('wpm') || 20;
        return Math.max(20, Math.round(1200 / wpm));
    }
    function scheduleNext() {
        const keyer = State.get('keyer');
        if (!keyer.running) return;
        const dot = keyer.paddleDotPressed;
        const dash = keyer.paddleDashPressed;
        if (!dot && !dash) {
            keyer.loopTimer = setTimeout(scheduleNext, msPerDit() / 2);
            State.set('keyer', keyer);
            return;
        }
        let sendDot;
        if (dot && dash) {
            sendDot = keyer.nextIsDot;
            keyer.nextIsDot = !keyer.nextIsDot;
        } else if (dot) {
            sendDot = true;
        } else {
            sendDot = false;
        }
        State.set('keyer', keyer);
        const dit = msPerDit();
        const dah = dit * 3;
        const elem = sendDot ? dit : dah;
        if (!State.get('isMuted') && !State.get('isSearching')) {
            Audio.startTransmitting();
        }
        setTimeout(() => {
            if (State.get('isTransmitting')) Audio.stopTransmitting();
            const keyer2 = State.get('keyer');
            keyer2.loopTimer = setTimeout(scheduleNext, dit);
            State.set('keyer', keyer2);
        }, elem);
    }
    function setPaddle(which, pressed) {
        const keyer = State.get('keyer');
        if (which === 'dot') keyer.paddleDotPressed = pressed;
        else keyer.paddleDashPressed = pressed;
        State.set('keyer', keyer);
        if (!State.get('isManualMode')) {
            const left = document.getElementById('paddleLeft');
            const right = document.getElementById('paddleRight');
            if (left) (keyer.paddleDotPressed ? left.classList.add('active') : left.classList.remove('active'));
            if (right) (keyer.paddleDashPressed ? right.classList.add('active') : right.classList.remove('active'));
        }
        if (!State.get('isManualMode')) {
            start();
        }
    }
    function start() {
        const keyer = State.get('keyer');
        if (keyer.running) return;
        keyer.running = true;
        State.set('keyer', keyer);
        scheduleNext();
    }
    function stop() {
        const keyer = State.get('keyer');
        keyer.running = false;
        if (keyer.loopTimer) clearTimeout(keyer.loopTimer);
        if (keyer.gapTimer) clearTimeout(keyer.gapTimer);
        keyer.loopTimer = null;
        keyer.gapTimer = null;
        keyer.paddleDotPressed = false;
        keyer.paddleDashPressed = false;
        State.set('keyer', keyer);
        const left = document.getElementById('paddleLeft');
        const right = document.getElementById('paddleRight');
        if (left) left.classList.remove('active');
        if (right) right.classList.remove('active');
        if (State.get('isTransmitting')) Audio.stopTransmitting();
    }
    function init() {
        const modeToggle = DOM.get('modeToggle');
        if (modeToggle) modeToggle.checked = !State.get('isManualMode');
        const wpmSlider = DOM.get('wpmSlider');
        const wpmValue = DOM.get('wpmValue');
        if (wpmSlider) wpmSlider.value = String(State.get('wpm'));
        if (wpmValue) wpmValue.textContent = String(State.get('wpm'));
        DOM.toggleClass('wpmGroup', 'hidden', State.get('isManualMode'));
        DOM.toggleClass('keyHintManual', 'hidden', !State.get('isManualMode'));
        DOM.toggleClass('keyHintAuto', 'hidden', State.get('isManualMode'));
        DOM.toggleClass('morseKey', 'hidden', !State.get('isManualMode'));
        DOM.toggleClass('paddleKeyer', 'hidden', State.get('isManualMode'));
        const modeLabel = DOM.get('modeLabel');
        if (modeLabel) modeLabel.textContent = State.get('isManualMode') ? '手动' : '自动键';
    }
    return { init, start, stop, setPaddle };
})();
