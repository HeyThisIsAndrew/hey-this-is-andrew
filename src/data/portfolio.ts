// Photography portfolio data — Andrew's real bar/beverage photography.
// These are his photos (cocktails and dishes are the bar's, the photography is his).
// Served via Astro's image optimization; columns keep natural aspect ratios.

export interface PortfolioPhoto {
  file: string;
  width: number;
  height: number;
  orientation: "vertical" | "horizontal" | "square";
  category: "cocktails" | "bar" | "product";
  caption: string;
}

export const portfolioPhotos: PortfolioPhoto[] = [
  { file: "photo-00.jpg", width: 1320, height: 1760, orientation: "vertical", category: "cocktails", caption: "Smoked cocktail with amber glow" },
  { file: "photo-01.jpg", width: 1320, height: 1980, orientation: "vertical", category: "cocktails", caption: "Two cocktails, red and amber" },
  { file: "photo-02.jpg", width: 1320, height: 1760, orientation: "vertical", category: "cocktails", caption: "Coupe glass with warm backlight" },
  { file: "photo-03.jpg", width: 1320, height: 1651, orientation: "vertical", category: "cocktails", caption: "Cocktails on bar top" },
  { file: "photo-04.jpg", width: 1320, height: 1760, orientation: "vertical", category: "cocktails", caption: "Wine glass in dark bar" },
  { file: "photo-06.jpg", width: 1320, height: 1760, orientation: "vertical", category: "cocktails", caption: "Coupe glass, bartender hands" },
  { file: "photo-07.jpg", width: 1320, height: 1760, orientation: "vertical", category: "cocktails", caption: "Drinks on bar rail" },
  { file: "photo-08.jpg", width: 1320, height: 1760, orientation: "vertical", category: "cocktails", caption: "Espresso martini pour" },
  { file: "photo-09.jpg", width: 1320, height: 1760, orientation: "vertical", category: "product", caption: "Bottles on lit shelf" },
  { file: "photo-10.jpg", width: 1320, height: 1980, orientation: "vertical", category: "cocktails", caption: "Coupe with lime, warm light" },
  { file: "photo-11.jpg", width: 1320, height: 1760, orientation: "vertical", category: "bar", caption: "Bar storefront, daylight" },
  { file: "photo-12.jpg", width: 1320, height: 1760, orientation: "vertical", category: "cocktails", caption: "Red ale in tulip glass" },
  { file: "photo-13.jpg", width: 1320, height: 1760, orientation: "vertical", category: "cocktails", caption: "Two old fashioneds" },
  { file: "photo-14.jpg", width: 1320, height: 1760, orientation: "vertical", category: "bar", caption: "Bartenders at work" },
  { file: "photo-15.jpg", width: 1320, height: 1760, orientation: "vertical", category: "bar", caption: "Bar storefront, daylight alt" },
  { file: "photo-17.jpg", width: 1320, height: 1760, orientation: "vertical", category: "cocktails", caption: "Espresso martini with orange" },
  { file: "photo-18.jpg", width: 1320, height: 1760, orientation: "vertical", category: "cocktails", caption: "Red and amber cocktails" },
  { file: "photo-19.jpg", width: 1320, height: 1760, orientation: "vertical", category: "cocktails", caption: "Espresso martini on slate" },
  { file: "photo-20.jpg", width: 1320, height: 1760, orientation: "vertical", category: "bar", caption: "Back bar with reels and bottles" },
  { file: "photo-23.jpg", width: 1320, height: 1760, orientation: "vertical", category: "cocktails", caption: "Coupe in black and white" },
  { file: "photo-25.jpg", width: 1320, height: 1760, orientation: "vertical", category: "cocktails", caption: "Coupe with lime leaf" },
  { file: "photo-26.jpg", width: 1320, height: 881, orientation: "horizontal", category: "cocktails", caption: "Cocktail pour, motion" },
  { file: "photo-27.jpg", width: 1320, height: 881, orientation: "horizontal", category: "cocktails", caption: "Red ale, bar light" },
];

export const categoryLabels: Record<PortfolioPhoto["category"], string> = {
  cocktails: "Cocktails",
  bar: "Bars",
  product: "Product",
};
