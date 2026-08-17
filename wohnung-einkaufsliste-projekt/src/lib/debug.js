// debug.js
const { fetchOgImage } = require("./ogImage");

const urls = [
  "https://www.xxxlutz.at/p/carryhome-bigsofa-in-cord-naturfarben-000670002404",
  "https://www.kaufland.at/product/546610622/",
  "https://www.amazon.de/Arendo-Borosilikatglas-hitzebest%C3%A4ndig-Mikrowellen-K%C3%BCchenmessbecher/dp/B0CX97HXY3",
];

(async () => {
  for (const url of urls) {
    console.log("\n─── " + url);
    const img = await fetchOgImage(url);
    console.log("→", img);
  }
  process.exit(0);
})();
