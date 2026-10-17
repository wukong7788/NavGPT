import type { ProductInfo } from "../../shared/product";

export type { ProductInfo };
export { formatProductBlock } from "../../shared/product";

export function isProductPage(pathname = location.pathname): boolean {
  return /\/pr\//i.test(pathname);
}

function metaContent(name: string): string {
  const el = document.querySelector(
    `meta[property="${name}"], meta[name="${name}"]`
  );
  return (el?.getAttribute("content") || "").trim();
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function typeMatches(node: unknown, type: string): boolean {
  if (!node || typeof node !== "object") return false;
  const t = (node as { "@type"?: string | string[] })["@type"];
  return asArray(t).some((x) => String(x).toLowerCase() === type.toLowerCase());
}

function walkJsonLd(node: unknown, out: unknown[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((item) => walkJsonLd(item, out));
    return;
  }
  if (typeof node !== "object") return;
  out.push(node);
  const obj = node as Record<string, unknown>;
  if (obj["@graph"]) walkJsonLd(obj["@graph"], out);
}

function parseJsonLdScripts(): unknown[] {
  const nodes: unknown[] = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    try {
      walkJsonLd(JSON.parse(el.textContent || ""), nodes);
    } catch {
      // ignore malformed JSON-LD
    }
  });
  return nodes;
}

function findProductNode(): Record<string, unknown> | null {
  for (const node of parseJsonLdScripts()) {
    if (typeMatches(node, "Product") && typeof node === "object" && node) {
      return node as Record<string, unknown>;
    }
  }
  return null;
}

function readBrand(product: Record<string, unknown> | null): string {
  if (!product) return "";
  const brand = product.brand;
  if (typeof brand === "string") return brand.trim();
  if (brand && typeof brand === "object") {
    const name = (brand as { name?: unknown }).name;
    if (typeof name === "string") return name.trim();
  }
  return "";
}

function readOffer(product: Record<string, unknown> | null): { price: string; currency: string } {
  if (!product) return { price: "", currency: "" };
  const offer = asArray(product.offers)[0] as Record<string, unknown> | undefined;
  if (!offer) return { price: "", currency: "" };
  const price = offer.price != null ? String(offer.price).trim() : "";
  const currency =
    typeof offer.priceCurrency === "string" ? offer.priceCurrency.trim() : "";
  return { price, currency };
}

function readRating(product: Record<string, unknown> | null): {
  rating: string;
  reviewCount: string;
} {
  if (!product) return { rating: "", reviewCount: "" };
  const agg = product.aggregateRating;
  if (!agg || typeof agg !== "object") return { rating: "", reviewCount: "" };
  const a = agg as Record<string, unknown>;
  const rating = a.ratingValue != null ? String(a.ratingValue).trim() : "";
  const reviewCount = a.reviewCount != null ? String(a.reviewCount).trim() : "";
  return { rating, reviewCount };
}

function truncate(text: string, max = 600): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

/** Build a stable product snapshot for prompt templates. */
export function extractProduct(): ProductInfo {
  const product = findProductNode();
  const offer = readOffer(product);
  const rating = readRating(product);

  const name =
    (typeof product?.name === "string" && product.name.trim()) ||
    metaContent("og:title") ||
    document.querySelector("h1")?.textContent?.trim() ||
    document.title.trim() ||
    "";

  const brand = readBrand(product);
  const description =
    (typeof product?.description === "string" && product.description.trim()) ||
    metaContent("og:description") ||
    "";

  const url =
    metaContent("og:url") ||
    location.href.split("?")[0].split("#")[0];

  return {
    name,
    brand,
    price: offer.price,
    currency: offer.currency,
    description: truncate(description),
    rating: rating.rating,
    reviewCount: rating.reviewCount,
    url,
  };
}
