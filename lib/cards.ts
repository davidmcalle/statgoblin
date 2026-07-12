import { readFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

// Award "sharable" cards: the character's art as the background with the
// award text composed over it — rendered server-side (satori → SVG → PNG)
// and attached to the Discord message, so the text sits on the image itself.

const WIDTH = 480;
const HEIGHT = 600;

let fontsPromise: Promise<{ regular: Buffer; bold: Buffer }> | null = null;
function loadFonts() {
  fontsPromise ??= (async () => {
    const dir = path.join(process.cwd(), "public", "fonts");
    const [regular, bold] = await Promise.all([
      readFile(path.join(dir, "SourceSans3-Regular.ttf")),
      readFile(path.join(dir, "SourceSans3-Bold.ttf")),
    ]);
    return { regular, bold };
  })();
  return fontsPromise;
}

/**
 * Sniff the real image format from magic bytes. Servers lie about
 * Content-Type (DDB serves PNG bytes as `image/jpeg`), and resvg decodes by
 * the data-URI mime, not the bytes — a wrong mime rasterizes to nothing. Only
 * the formats resvg can actually decode return a mime; webp/avif/unknown
 * return null so the card falls back to the initial instead of a blank.
 */
function sniffImageMime(b: Buffer): string | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  return null;
}

/** Fetch a portrait and inline it as a data URI (satori doesn't fetch). */
async function fetchImageDataUri(url: string | undefined): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 8_000_000) return null;
    const mime = sniffImageMime(buf);
    if (!mime) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

type El = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown, rest?: Record<string, unknown>): El => ({
  type,
  props: { style, ...(children !== undefined ? { children } : {}), ...rest },
});

/** Render the card set for a summary's awards; a failed card is skipped. */
export async function renderAwardCards(
  awards: { title: string; actorName: string; statLine: string }[],
  actorImages: Map<string, string>,
  sessionLabel: string,
): Promise<{ name: string; title: string; data: Buffer }[]> {
  const cards = await Promise.all(
    awards.slice(0, 9).map(async (a, i) => {
      try {
        const data = await renderAwardCard({
          title: a.title,
          actorName: a.actorName,
          statLine: a.statLine,
          sessionLabel,
          imageUrl: actorImages.get(a.actorName),
        });
        return { name: `award-${i}.png`, title: a.title, data };
      } catch {
        return null;
      }
    }),
  );
  return cards.filter((c): c is { name: string; title: string; data: Buffer } => c !== null);
}

export type AwardCardInput = {
  title: string;
  actorName: string;
  statLine: string;
  sessionLabel: string;
  imageUrl?: string;
};

/** One award card PNG. */
export async function renderAwardCard(input: AwardCardInput): Promise<Buffer> {
  const fonts = await loadFonts();
  const portrait = await fetchImageDataUri(input.imageUrl);

  const tree = el(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: "#171716",
      position: "relative",
      fontFamily: "Source Sans",
    },
    [
      // Background art (or initial) filling the card
      portrait
        ? el("img", { position: "absolute", width: WIDTH, height: HEIGHT, objectFit: "cover" }, undefined, { src: portrait, width: WIDTH, height: HEIGHT })
        : el(
            "div",
            {
              position: "absolute",
              width: WIDTH,
              height: HEIGHT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#3a3a38",
              fontSize: 260,
              fontWeight: 700,
            },
            input.actorName.slice(0, 1),
          ),
      // Legibility gradient over the lower half
      el("div", {
        position: "absolute",
        width: WIDTH,
        height: HEIGHT,
        backgroundImage:
          "linear-gradient(to bottom, rgba(13,13,12,0.55) 0%, rgba(13,13,12,0.0) 28%, rgba(13,13,12,0.0) 42%, rgba(13,13,12,0.88) 72%, rgba(13,13,12,0.96) 100%)",
      }),
      // Session tag, top left
      el(
        "div",
        {
          position: "absolute",
          top: 18,
          left: 22,
          color: "rgba(255,255,255,0.75)",
          fontSize: 15,
          letterSpacing: 2,
          textTransform: "uppercase",
        },
        input.sessionLabel,
      ),
      // Text block, bottom
      el(
        "div",
        {
          position: "absolute",
          bottom: 0,
          left: 0,
          display: "flex",
          flexDirection: "column",
          padding: "0 26px 26px 26px",
          width: WIDTH,
        },
        [
          el("div", { color: "#7fd6a4", fontSize: 21, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }, input.title),
          el("div", { color: "#ffffff", fontSize: 34, fontWeight: 700, lineHeight: 1.1, marginTop: 6 }, input.actorName),
          el("div", { color: "rgba(255,255,255,0.8)", fontSize: 19, lineHeight: 1.35, marginTop: 12 }, input.statLine),
        ],
      ),
    ],
  );

  const svg = await satori(tree as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "Source Sans", data: fonts.regular, weight: 400, style: "normal" },
      { name: "Source Sans", data: fonts.bold, weight: 700, style: "normal" },
    ],
  });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng());
}
