import { EventEmitter } from 'events';
import { URL } from 'url';
export class AbstractSocketClient extends EventEmitter {
    constructor(url, config) {
        super();
        this.url = url;
        this.config = config;
        // Set max listeners from config (default: 50)
        // WARNING: 0 disables limit and allows potential memory leaks
        const maxListeners = this.config.maxSocketClientListeners ?? 50;
        if (maxListeners === 0) {
            this.config.logger?.warn('SocketClient setMaxListeners(0) allows UNLIMITED listeners - potential memory leak!');
        }
        this.setMaxListeners(maxListeners);
    }
}
//# sourceMappingURL=types.js.map