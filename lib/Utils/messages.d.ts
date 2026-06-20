import { type Transform } from 'stream';
import { proto } from '../../WAProto/index.js';
import type { AnyMediaMessageContent, AnyMessageContent, ButtonMessageOptions, CarouselMessageOptions, ListMessageOptions, MessageContentGenerationOptions, MessageGenerationOptions, MessageGenerationOptionsFromContent, MessageUserReceipt, NativeButton, NativeFlowButton, ProductCarouselMessageOptions, ProductListMessageOptions, WAMessage, WAMessageContent, WAMessageKey } from '../Types/index.js';
import type { ILogger } from './logger.js';
import { type MediaDownloadOptions } from './messages-media.js';
type ExtractByKey<T, K extends PropertyKey> = T extends Record<K, any> ? T : never;
/**
 * Uses a regex to test whether the string contains a URL, and returns the URL if it does.
 * @param text eg. hello https://google.com
 * @returns the URL, eg. https://google.com
 */
export declare const extractUrlFromText: (text: string) => string | undefined;
export declare const generateLinkPreviewIfRequired: (text: string, getUrlInfo: MessageGenerationOptions["getUrlInfo"], logger: MessageGenerationOptions["logger"]) => Promise<import("../Types/index.js").WAUrlInfo | undefined>;
export declare const prepareWAMessageMedia: (message: AnyMediaMessageContent, options: MessageContentGenerationOptions) => Promise<proto.Message>;
export declare const prepareDisappearingMessageSettingContent: (ephemeralExpiration?: number) => proto.Message;
/**
 * Generate forwarded message content like WA does
 * @param message the message to forward
 * @param options.forceForward will show the message as forwarded even if it is from you
 */
export declare const generateForwardMessageContent: (message: WAMessage, forceForward?: boolean) => proto.IMessage;
export declare const hasNonNullishProperty: <K extends PropertyKey>(message: AnyMessageContent, key: K) => message is ExtractByKey<AnyMessageContent, K>;
/**
 * Converts a NativeButton to the WhatsApp Native Flow format
 * Includes validation for required fields
 */
export declare const formatNativeFlowButton: (button: NativeButton) => NativeFlowButton;
/**
 * Generates a button message using Native Flow format wrapped in viewOnceMessage
 * This is the modern approach for button messages that works on iOS and Android
 *
 * @example
 * ```typescript
 * const msg = await generateButtonMessage({
 *   buttons: [
 *     { type: 'url', text: 'Visit Site', url: 'https://example.com' },
 *     { type: 'copy', text: 'Copy Code', copyText: 'ABC123' },
 *     { type: 'reply', text: 'Contact Support', id: 'btn_support' }
 *   ],
 *   text: 'Choose an option:',
 *   footer: 'Powered by InfiniteAPI'
 * }, options)
 * await sock.sendMessage(jid, msg)
 * ```
 */
export declare const generateButtonMessage: (options: ButtonMessageOptions, mediaOptions?: MessageContentGenerationOptions) => Promise<WAMessageContent>;
/**
 * Generates a carousel message with multiple cards, each with their own buttons
 * Uses viewOnceMessage wrapper for better iOS/Android compatibility
 *
 * @example
 * ```typescript
 * const msg = await generateCarouselMessage({
 *   cards: [
 *     {
 *       title: 'Product 1',
 *       body: 'Amazing product description',
 *       footer: '$99.00',
 *       buttons: [
 *         { type: 'url', text: 'Buy Now', url: 'https://shop.com/item1' }
 *       ]
 *     },
 *     {
 *       title: 'Product 2',
 *       body: 'Another great product',
 *       footer: '$149.00',
 *       buttons: [
 *         { type: 'url', text: 'Buy Now', url: 'https://shop.com/item2' }
 *       ]
 *     }
 *   ],
 *   text: 'Check out our products!',
 *   footer: 'Swipe to see more'
 * }, options)
 * await sock.sendMessage(jid, msg)
 * ```
 */
export declare const generateCarouselMessage: (options: CarouselMessageOptions, mediaOptions?: MessageContentGenerationOptions) => Promise<WAMessageContent>;
export declare const generateListMessage: (options: ListMessageOptions) => WAMessageContent;
/**
 * Generates a product list message (multi-product) from the WhatsApp Business catalog
 * Allows sending multiple products organized in sections
 *
 * Note: Requires a WhatsApp Business account with a configured catalog.
 * Does NOT require Meta Business Manager integration.
 *
 * @example
 * ```typescript
 * const msg = generateProductListMessage({
 *   title: 'Our Best Sellers',
 *   description: 'Check out our most popular products!',
 *   buttonText: 'View Products',
 *   footerText: 'Tap to browse our catalog',
 *   businessOwnerJid: '5511999999999@s.whatsapp.net',
 *   productSections: [
 *     {
 *       title: 'Electronics',
 *       products: [
 *         { productId: 'product_001' },
 *         { productId: 'product_002' }
 *       ]
 *     },
 *     {
 *       title: 'Accessories',
 *       products: [
 *         { productId: 'product_003' },
 *         { productId: 'product_004' }
 *       ]
 *     }
 *   ],
 *   headerImage: { productId: 'product_001' }
 * })
 * await sock.sendMessage(jid, msg)
 * ```
 */
export declare const generateProductListMessage: (options: ProductListMessageOptions) => WAMessageContent;
/**
 * Generates a product carousel message using products from WhatsApp Business catalog
 * Uses viewOnceMessage wrapper for better iOS/Android compatibility
 *
 * Each card in the carousel references a product from the business catalog using
 * collectionMessage with bizJid (business owner) and id (product ID).
 *
 * @example
 * ```typescript
 * const msg = generateProductCarouselMessage({
 *   businessOwnerJid: '5511999999999@s.whatsapp.net',
 *   products: [
 *     { productId: 'produto_001' },
 *     { productId: 'produto_002' },
 *     { productId: 'produto_003' }
 *   ],
 *   body: 'Confira nossos produtos em destaque!'
 * })
 * await sock.sendMessage(jid, msg)
 * ```
 */
export declare const generateProductCarouselMessage: (options: ProductCarouselMessageOptions) => WAMessageContent;
/**
 * Generates a button message using the legacy buttonsMessage format
 * ⚠️ WARNING: This format is deprecated and may not work on all devices
 *
 * @deprecated Use generateButtonMessage instead for better compatibility
 */
export declare const generateButtonMessageLegacy: (buttons: Array<{
    id?: string;
    text: string;
}>, text: string, footer?: string) => WAMessageContent;
/**
 * Generates a list message using the legacy listMessage format
 * ⚠️ WARNING: This format is deprecated and may not work on all devices
 *
 * @deprecated Use generateListMessage instead for better compatibility
 */
export declare const generateListMessageLegacy: (listInfo: {
    sections: Array<{
        title: string;
        rows: Array<{
            id?: string;
            rowId?: string;
            title: string;
            description?: string;
        }>;
    }>;
}, title: string, description: string, buttonText: string, footer?: string) => WAMessageContent;
export declare const generateWAMessageContent: (message: AnyMessageContent, options: MessageContentGenerationOptions) => Promise<proto.IMessage>;
export declare const generateWAMessageFromContent: (jid: string, message: WAMessageContent, options: MessageGenerationOptionsFromContent) => WAMessage;
export declare const generateWAMessage: (jid: string, content: AnyMessageContent, options: MessageGenerationOptions) => Promise<WAMessage>;
/** Get the key to access the true type of content */
export declare const getContentType: (content: proto.IMessage | undefined) => keyof proto.IMessage | undefined;
/**
 * Normalizes ephemeral, view once messages to regular message content
 * Eg. image messages in ephemeral messages, in view once messages etc.
 * @param content
 * @returns
 */
export declare const normalizeMessageContent: (content: WAMessageContent | null | undefined) => WAMessageContent | undefined;
/**
 * Extract the true message content from a message
 * Eg. extracts the inner message from a disappearing message/view once message
 */
export declare const extractMessageContent: (content: WAMessageContent | undefined | null) => WAMessageContent | undefined;
/**
 * Returns the device predicted by message ID
 */
export declare const getDevice: (id: string) => "unknown" | "web" | "android" | "ios" | "desktop";
/** Upserts a receipt in the message */
export declare const updateMessageWithReceipt: (msg: Pick<WAMessage, "userReceipt">, receipt: MessageUserReceipt) => void;
/** Update the message with a new reaction */
export declare const updateMessageWithReaction: (msg: Pick<WAMessage, "reactions">, reaction: proto.IReaction) => void;
/** Update the message with a new poll update */
export declare const updateMessageWithPollUpdate: (msg: Pick<WAMessage, "pollUpdates">, update: proto.IPollUpdate) => void;
/** Update the message with a new event response */
export declare const updateMessageWithEventResponse: (msg: Pick<WAMessage, "eventResponses">, update: proto.IEventResponse) => void;
type VoteAggregation = {
    name: string;
    voters: string[];
};
/**
 * Aggregates all poll updates in a poll.
 * @param msg the poll creation message
 * @param meId your jid
 * @returns A list of options & their voters
 */
export declare function getAggregateVotesInPollMessage({ message, pollUpdates }: Pick<WAMessage, 'pollUpdates' | 'message'>, meId?: string): VoteAggregation[];
type ResponseAggregation = {
    response: string;
    responders: string[];
};
/**
 * Aggregates all event responses in an event message.
 * @param msg the event creation message
 * @param meId your jid
 * @returns A list of response types & their responders
 */
export declare function getAggregateResponsesInEventMessage({ eventResponses }: Pick<WAMessage, 'eventResponses'>, meId?: string): ResponseAggregation[];
/** Given a list of message keys, aggregates them by chat & sender. Useful for sending read receipts in bulk */
export declare const aggregateMessageKeysNotFromMe: (keys: WAMessageKey[]) => {
    jid: string;
    participant: string | undefined;
    messageIds: string[];
}[];
type DownloadMediaMessageContext = {
    reuploadRequest: (msg: WAMessage) => Promise<WAMessage>;
    logger: ILogger;
};
/**
 * Downloads the given message. Throws an error if it's not a media message.
 *
 * PR #493 review P2-002 — note on `options.host`:
 * `MediaDownloadOptions.host` (per-socket CDN host introduced in upstream
 * #2432) is passed through to `downloadContentFromMessage` verbatim. When
 * the message's proto carries a WhatsApp-CDN-signed `url`, that URL is
 * used as-is (post-P1-001 fix) and `options.host` is ignored. When only
 * `directPath` is present, `options.host` controls the CDN host used to
 * build the URL.
 *
 * Consumers who want this socket's CDN host should pass:
 * ```ts
 * await downloadMediaMessage(msg, 'buffer', { host: sock.getMediaHost() }, ctx)
 * ```
 *
 * Omitting `options.host` falls back to `DEF_MEDIA_HOST` ("mmg.whatsapp.net").
 */
export declare const downloadMediaMessage: <Type extends "buffer" | "stream">(message: WAMessage, type: Type, options: MediaDownloadOptions, ctx?: DownloadMediaMessageContext) => Promise<Type extends "buffer" ? Buffer<ArrayBufferLike> : Transform>;
/** Checks whether the given message is a media message; if it is returns the inner content */
export declare const assertMediaContent: (content: proto.IMessage | null | undefined) => proto.Message.IVideoMessage | proto.Message.IImageMessage | proto.Message.IAudioMessage | proto.Message.IDocumentMessage | proto.Message.IStickerMessage;
export {};
//# sourceMappingURL=messages.d.ts.map