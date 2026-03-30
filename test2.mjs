import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

const pdfPath = 'c:/Users/User/Documents/QR_Pallet/Etiquetas_Pallets_3500_medidores_iG1,6NB.pdf';
const arrayBuffer = fs.readFileSync(pdfPath);
const uint8Array = new Uint8Array(arrayBuffer);

pdfjsLib.getDocument({ data: uint8Array }).promise.then(async pdf => {
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  
  const itemsByY = {};
  for (const item of textContent.items) {
    if (!item.transform) continue;
    const y = Math.round(item.transform[5] / 5) * 5; // round to nearest 5 to group slightly misaligned text
    if (!itemsByY[y]) itemsByY[y] = [];
    itemsByY[y].push(item);
  }

  const sortedY = Object.keys(itemsByY).map(Number).sort((a, b) => b - a);
  let lines = [];
  for (const y of sortedY) {
    const lineItems = itemsByY[y].sort((a, b) => a.transform[4] - b.transform[4]);
    lines.push(lineItems.map(item => item.str).join(' '));
  }
  
  fs.writeFileSync('raw_utf8_sorted.txt', lines.join('\n'), 'utf-8');
}).catch(e => console.error(e));
