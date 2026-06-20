import { proto } from '../../WAProto/index.js';
import type { StickerPack, WAMediaUploadFunction } from '../Types/Message.js';
import type { ILogger } from './logger.js';
/**
 * Verifica se um buffer é um arquivo WebP válido
 * Valida os magic bytes: RIFF....WEBP
 *
 * @param buffer - Buffer to check
 * @returns true if buffer is valid WebP format
 *
 * @example
 * ```typescript
 * const buffer = await readFile('image.webp')
 * if (isWebPBuffer(buffer)) {
 *   console.log('Valid WebP file')
 * }
 * ```
 */
export declare const isWebPBuffer: (buffer: Buffer) => boolean;
/**
 * Detecta se um WebP é animado através da análise de chunks
 *
 * Analisa a estrutura do arquivo WebP procurando por:
 * - VP8X header com animation flag (bit 1)
 * - Chunks ANIM (animation) ou ANMF (animation frame)
 *
 * SECURITY: Implements robust validation to prevent:
 * - Integer overflow attacks (malicious chunk sizes)
 * - Out-of-bounds reads (buffer overflow)
 * - Infinite loop DoS (iteration limit)
 *
 * @param buffer - WebP buffer to analyze
 * @returns true if WebP is animated, false if static or malformed
 *
 * @example
 * ```typescript
 * const webpBuffer = await readFile('sticker.webp')
 * if (isAnimatedWebP(webpBuffer)) {
 *   console.log('Animated sticker detected')
 * }
 * ```
 */
export declare const isAnimatedWebP: (buffer: Buffer) => boolean;
/**
 * Detecta se um buffer é Lottie JSON (raw ou gzip-compressed/WAS)
 *
 * WABA usa mimetype `application/was` para stickers Lottie.
 * WAS (WhatsApp Animated Sticker) = gzip-compressed Lottie JSON.
 *
 * Detecção:
 * - Gzip (0x1f 0x8b): descomprime e verifica se é Lottie JSON
 * - JSON bruto: verifica campos Lottie obrigatórios (v, ip, op, layers)
 *
 * @param buffer - Buffer to check
 * @returns true if buffer is Lottie/WAS format
 */
export declare const isLottieBuffer: (buffer: Buffer) => boolean;
export type PrepareStickerPackMessageOptions = {
    /** Upload function to encrypt and upload media to WhatsApp servers */
    upload: WAMediaUploadFunction;
    /** Optional logger for debugging */
    logger?: ILogger;
    /** Timeout for media uploads */
    mediaUploadTimeoutMs?: number;
};
/**
 * Prepara uma mensagem de sticker pack para envio
 *
 * **Processo:**
 * 1. Valida número de stickers (3-30 conforme padrão WhatsApp oficial)
 * 2. Processa cada sticker (converte para WebP se necessário)
 * 3. Cria ZIP com stickers + cover (deduplicação automática por hash)
 * 4. Criptografa ZIP usando AES-256-CBC + HMAC-SHA256
 * 5. Gera thumbnail da capa (252x252 JPEG)
 * 6. Faz upload do ZIP e thumbnail (reutiliza mesma mediaKey)
 * 7. Retorna proto.Message.StickerPackMessage completo
 *
 * **Especificações WhatsApp:**
 * - 3-30 stickers por pack (oficial)
 * - WebP ou Lottie/WAS (application/was)
 * - Stickers: 512x512 pixels (auto-resize)
 * - Recomendado: 100KB por sticker estático, 500KB animado
 * - Tray icon: 96x96 pixels (PNG no ZIP)
 * - Thumbnail: 252x252 pixels (JPEG, upload separado)
 *
 * @param stickerPack - Sticker pack data with stickers, cover, name, publisher
 * @param options - Upload function and optional logger
 * @returns Prepared StickerPackMessage ready to send
 *
 * @throws {Boom} If validation fails (sticker count, size limits, format issues)
 *
 * @example
 * ```typescript
 * const stickerPackMessage = await prepareStickerPackMessage(
 *   {
 *     name: 'My Pack',
 *     publisher: 'Author',
 *     cover: coverBuffer,
 *     stickers: [
 *       { data: sticker1Buffer, emojis: ['😀'] },
 *       { data: sticker2Buffer, emojis: ['😎'] }
 *     ]
 *   },
 *   { upload: uploadFunction, logger }
 * )
 * ```
 */
export declare const prepareStickerPackMessage: (stickerPack: StickerPack, options: PrepareStickerPackMessageOptions) => Promise<proto.Message.StickerPackMessage>;
//# sourceMappingURL=sticker-pack.d.ts.map