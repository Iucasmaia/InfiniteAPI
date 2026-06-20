import { assertNodeErrorFree } from '../../WABinary/index.js';
import { USyncUser } from '../USyncUser.js';
export class USyncUsernameProtocol {
    constructor() {
        this.name = 'username';
    }
    getQueryElement() {
        return {
            tag: 'username',
            attrs: {}
        };
    }
    getUserElement(user) {
        void user;
        return null;
    }
    parser(node) {
        if (node.tag === 'username') {
            assertNodeErrorFree(node);
            if (typeof node.content === 'string') {
                return node.content;
            }
            // Username may arrive as Uint8Array/Buffer — decode as UTF-8.
            // (Plain Uint8Array.prototype.toString() returns comma-separated byte
            // values like "97,98", not the actual text — use Buffer or TextDecoder.)
            if (node.content instanceof Uint8Array) {
                const decoded = Buffer.from(node.content).toString('utf8');
                return decoded.length > 0 ? decoded : null;
            }
        }
        return null;
    }
}
//# sourceMappingURL=USyncUsernameProtocol.js.map