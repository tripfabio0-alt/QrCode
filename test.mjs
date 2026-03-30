import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

const pdfPath = 'c:/Users/User/Documents/QR_Pallet/Etiquetas_Pallets_3500_medidores_iG1,6NB.pdf';
const arrayBuffer = fs.readFileSync(pdfPath);
const uint8Array = new Uint8Array(arrayBuffer);

pdfjsLib.getDocument({ data: uint8Array }).promise.then(async pdf => {
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const text = textContent.items.map(item => item.str).join('\n');
  fs.writeFileSync('raw_utf8.txt', text, 'utf-8');
}).catch(e => console.error(e));
