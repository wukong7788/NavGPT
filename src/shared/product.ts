/** Shared product snapshot used by shopping-site → AI prompts. */

export type ProductInfo = {
  name: string;
  brand: string;
  price: string;
  currency: string;
  description: string;
  rating: string;
  reviewCount: string;
  url: string;
};

/** Format product fields into a readable block for the prompt body. */
export function formatProductBlock(product: ProductInfo): string {
  const lines: string[] = [];
  if (product.name) lines.push(`商品名称：${product.name}`);
  if (product.brand) lines.push(`品牌：${product.brand}`);
  if (product.price) {
    const priceLabel = product.currency
      ? `${product.currency} ${product.price}`
      : product.price;
    lines.push(`价格：${priceLabel}`);
  }
  if (product.rating) {
    const reviews = product.reviewCount ? `（${product.reviewCount} 评价）` : "";
    lines.push(`评分：${product.rating}${reviews}`);
  }
  if (product.description) lines.push(`简介：${product.description}`);
  if (product.url) lines.push(`商品链接：${product.url}`);
  return lines.join("\n") || "(未能读取商品信息)";
}
