import WebSocket from 'ws';
import { DEFAULT_ORIGIN } from '../../Defaults/index.js';
import { AbstractSocketClient } from './types.js';
export class WebSocketClient extends AbstractSocketClient {
    constructor() {
        super(...arguments);
        this.socket = null;
    }
    get isOpen() {
        return this.socket?.readyState === WebSocket.OPEN;
    }
    get isClosed() {
        return this.socket === null || this.socket?.readyState === WebSocket.CLOSED;
    }
    get isClosing() {
        return this.socket === null || this.socket?.readyState === WebSocket.CLOSING;
    }
    get isConnecting() {
        return this.socket?.readyState === WebSocket.CONNECTING;
    }
    connect() {
        if (this.socket) {
            return;
        }
        this.socket = new WebSocket(this.url, {
            origin: DEFAULT_ORIGIN,
            headers: this.config.options?.headers,
            handshakeTimeout: this.config.connectTimeoutMs,
            timeout: this.config.connectTimeoutMs,
            agent: this.config.agent
        });
        // Set max listeners from config (default: 20)
        // WARNING: 0 disables limit and allows potential memory leaks
        const maxListeners = this.config.maxWebSocketListeners ?? 20;
        if (maxListeners === 0) {
            this.config.logger?.warn('WebSocket setMaxListeners(0) allows UNLIMITED listeners - potential memory leak!');
        }
        this.socket.setMaxListeners(maxListeners);
        const events = ['close', 'error', 'upgrade', 'message', 'open', 'ping', 'pong', 'unexpected-response'];
        for (const event of events) {
            this.socket?.on(event, (...args) => this.emit(event, ...args));
        }
    }
    async close(timeoutMs = 5000) {
        if (!this.socket) {
            return;
        }
        const closePromise = new Promise(resolve => {
            this.socket?.once('close', resolve);
        });
        this.socket.close();
        // Audit ROBUST-001 — antes `await closePromise` ficava pendente
        // indefinidamente se o WS não emitisse `close` (TCP half-open, RST
        // nunca recebido, servidor degradado). Race com timeout + fallback
        // pra `terminate()` garante que reconexão sempre ocorre em ≤5s.
        let timeoutHandle;
        const timeoutPromise = new Promise(resolve => {
            timeoutHandle = setTimeout(() => resolve('timeout'), timeoutMs);
        });
        const result = await Promise.race([closePromise.then(() => 'closed'), timeoutPromise]);
        if (timeoutHandle)
            clearTimeout(timeoutHandle);
        if (result === 'timeout') {
            // Last resort — force the WebSocket transport down. terminate()
            // shuts down the underlying TCP socket without waiting for the
            // close frame to round-trip.
            try {
                this.socket?.terminate?.();
            }
            catch {
                /* best effort */
            }
        }
        this.socket = null;
    }
    send(str, cb) {
        this.socket?.send(str, cb);
        return Boolean(this.socket);
    }
}
//# sourceMappingURL=websocket.js.map