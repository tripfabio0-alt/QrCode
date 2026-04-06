import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

const pdfPath = "NF 7804 1 _Novo.pdf";
const data = new Uint8Array(fs.readFileSync(pdfPath));
const loadingTask = pdfjsLib.getDocument({ data });

loadingTask.promise.then(async function(pdf) {
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const itemsByY = {};
    for (const item of textContent.items) {
      if (!('transform' in item)) continue;
      const y = Math.round(item.transform[5] / 5) * 5;
      if (!itemsByY[y]) itemsByY[y] = [];
      itemsByY[y].push(item);
    }
  
    const sortedY = Object.keys(itemsByY).map(Number).sort((a, b) => b - a);
    const lines = [];
    for (const y of sortedY) {
      const lineItems = itemsByY[y].sort((a, b) => a.transform[4] - b.transform[4]);
      lines.push(lineItems.map((item) => item.str).join(' '));
    }
  
    fs.writeFileSync("out.txt", lines.join('\n'));
});
