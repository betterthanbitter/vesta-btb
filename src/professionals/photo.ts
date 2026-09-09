/**
 * Headshot validation.
 *
 * Checked again on the server. The browser checks are there so somebody is not
 * told about a problem after a slow upload — they are a courtesy, not a
 * control, because anything can post to the endpoint directly.
 */

export const PHOTO_RULES = {
  maxBytes: 5 * 1024 * 1024,
  /** Below this a 250px card portrait looks soft, which is most of the point. */
  minShortSide: 800,
  accepted: ['image/jpeg', 'image/png', 'image/webp'] as const,
};

export interface PhotoInput {
  /** data:image/jpeg;base64,… as produced by a file input. */
  dataUrl?: string;
  width?: number;
  height?: number;
}

export interface DecodedPhoto {
  mime: string;
  base64: string;
  byteSize: number;
  width?: number;
  height?: number;
}

export class PhotoError extends Error {}

/**
 * Magic bytes, so a renamed .exe cannot arrive claiming to be a JPEG.
 * The declared MIME type comes from the browser and is trivially forged.
 */
function sniff(base64: string): string | undefined {
  const head = atob(base64.slice(0, 32));
  const b = Array.from(head, (c) => c.charCodeAt(0));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return undefined;
}

export function decodePhoto(input: PhotoInput): DecodedPhoto | undefined {
  const dataUrl = (input.dataUrl ?? '').trim();
  if (!dataUrl) return undefined;

  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new PhotoError('That image could not be read. Please try another file.');

  const [, declaredMime, base64] = match;
  const byteSize = Math.floor((base64.length * 3) / 4);

  if (byteSize > PHOTO_RULES.maxBytes) {
    throw new PhotoError(
      `That image is ${(byteSize / 1024 / 1024).toFixed(1)}MB. Please keep it under 5MB.`,
    );
  }

  const actualMime = sniff(base64);
  if (!actualMime) {
    throw new PhotoError('That file is not a JPG, PNG or WebP image.');
  }
  if (!PHOTO_RULES.accepted.includes(actualMime as never)) {
    throw new PhotoError('Please upload a JPG, PNG or WebP.');
  }
  if (declaredMime !== actualMime) {
    // Not necessarily an attack — some browsers mislabel — but we store what
    // the bytes actually are, never what the upload claimed.
    console.warn(`[photo] declared ${declaredMime}, bytes say ${actualMime}`);
  }

  const short = Math.min(input.width ?? Infinity, input.height ?? Infinity);
  if (Number.isFinite(short) && short < PHOTO_RULES.minShortSide) {
    throw new PhotoError(
      `That image is ${input.width}×${input.height}. We need at least ` +
      `${PHOTO_RULES.minShortSide}px on the shorter side, or it looks blurred on your listing.`,
    );
  }

  return { mime: actualMime, base64, byteSize, width: input.width, height: input.height };
}
