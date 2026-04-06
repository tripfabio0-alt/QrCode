import * as pdfjsLib from 'pdfjs-dist';
import jsQR from 'jsqr';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface PalletInfo {
  volume: string;
  quantidade: string;
  notaFiscal: string;
  pedidoZenner: string;
  referencia: string;
  descricao: string;
  serieInicial: string;
  serieFinal: string;
  ordemCompra: string;
}

export interface PalletData {
  palletInfo: PalletInfo;
  qrData: string;
}

function extractField(text: string, fieldName: string): string {
  // Try multiple patterns
  const patterns = [
    new RegExp(`${fieldName}[:\\s]*([^\\n]+)`, 'i'),
    new RegExp(`${fieldName}[:\\s]*(.+?)(?=\\s{2,}|$)`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}

async function extractTextFromPage(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const textContent = await page.getTextContent();
  
  const itemsByY: { [y: number]: any[] } = {};
  for (const item of textContent.items) {
    if (!('transform' in item)) continue;
    const y = Math.round(item.transform[5] / 5) * 5;
    if (!itemsByY[y]) itemsByY[y] = [];
    itemsByY[y].push(item);
  }

  const sortedY = Object.keys(itemsByY).map(Number).sort((a, b) => b - a);
  const lines: string[] = [];
  for (const y of sortedY) {
    const lineItems = itemsByY[y].sort((a: any, b: any) => a.transform[4] - b.transform[4]);
    lines.push(lineItems.map((item: any) => item.str).join(' '));
  }

  return lines.join('\n');
}

function parsePalletInfo(text: string): PalletInfo {
  // Extract Volume field which contains pallet number like "1/30"
  const volumeMatch = text.match(/Volume[:\s]*(\d+\/\d+)/i);
  const quantidadeMatch = text.match(/Quantidade[:\s]*(\d+)/i);
  const notaFiscalMatch = text.match(/Nota\s*Fiscal[:\s]*(\d+)/i);
  const pedidoMatch = text.match(/Pedido\s*Zenner[:\s]*(\d+)/i);
  const referenciaMatch = text.match(/Refer[êe]ncia[:\s]*(\d+)/i);
  const descricaoMatch = text.match(/Descri[çc][aã]o[:\s]*([A-Z0-9\s,.\-]+?)(?=\n|Quantidade|$)/i);
  const serieInicialMatch = text.match(/(?:Numero de |Número de )?Serie\s*Inicial[:\s]+([A-Z0-9]+S?)/i);
  const serieFinalMatch = text.match(/(?:Numero de |Número de )?Serie\s*Final[:\s]+([A-Z0-9]+S?)/i);
  const ordemCompraMatch = text.match(/Ordem\s*de\s*Compra[:\s]*([^\n]*)/i);

  return {
    volume: volumeMatch?.[1] || '',
    quantidade: quantidadeMatch?.[1] || '',
    notaFiscal: notaFiscalMatch?.[1] || '',
    pedidoZenner: pedidoMatch?.[1] || '',
    referencia: referenciaMatch?.[1] || '',
    descricao: descricaoMatch?.[1]?.trim() || '',
    serieInicial: serieInicialMatch?.[1] || '',
    serieFinal: serieFinalMatch?.[1] || '',
    ordemCompra: ordemCompraMatch?.[1] || '',
  };
}

async function renderPageToCanvasContext(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number, scale: number) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Fill white background to avoid transparency issues
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  return { ctx, width: canvas.width, height: canvas.height };
}

async function readQRCodesFromPage(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<string[]> {
  // Tenta múltiplas escalas, incluindo resoluções mais altas e intermediárias para lidar com variação de renderização (aliasing) do jsQR.
  const scales = [2, 2.5, 3, 3.5, 4, 4.5, 5, 1.5];
  for (const scale of scales) {
    try {
      const { ctx, width, height } = await renderPageToCanvasContext(pdf, pageNum, scale);
      let imageData = ctx.getImageData(0, 0, width, height);
      
      const foundCodes: string[] = [];

      while (true) {
        const code = jsQR(imageData.data, width, height, {
          inversionAttempts: 'attemptBoth',
        });
        
        if (!code) break; // No more QR codes found at this scale

        if (code.data && !foundCodes.includes(code.data)) {
          foundCodes.push(code.data);
        }

        // Erase the detected QR code (fill with white) to find the next one
        const loc = code.location;
        const pts = [loc.topLeftCorner, loc.topRightCorner, loc.bottomRightCorner, loc.bottomLeftCorner];
        const minX = Math.min(...pts.map(p => p.x));
        const maxX = Math.max(...pts.map(p => p.x));
        const minY = Math.min(...pts.map(p => p.y));
        const maxY = Math.max(...pts.map(p => p.y));
        
        const padding = 15;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(minX - padding, minY - padding, (maxX - minX) + padding * 2, (maxY - minY) + padding * 2);
        
        // Grab the updated image data
        imageData = ctx.getImageData(0, 0, width, height);
      }

      if (foundCodes.length > 0) {
        return foundCodes; 
      }
    } catch (e) {
      console.warn(`QR scan failed at scale ${scale}:`, e);
    }
  }
  return [];
}

export async function processPDF(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<PalletData[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const results: PalletData[] = [];
  
  let currentPallet: PalletData | null = null;

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.(i, totalPages);
    
    // Leitura rápida de texto para checar se é página de Pallet
    const text = await extractTextFromPage(pdf, i);
    const palletInfo = parsePalletInfo(text);

    // Se possui atributos chave de OCR, é uma capa de Pallet
    if (palletInfo.volume || palletInfo.quantidade || palletInfo.referencia) {
      currentPallet = { palletInfo, qrData: '' };
      results.push(currentPallet);
    } 
    // Se não, assumimos que é uma página de QR Codes pertencente ao último Pallet lido
    else if (currentPallet) {
      const qrCodes = await readQRCodesFromPage(pdf, i);
      if (qrCodes.length > 0) {
        const sep = currentPallet.qrData ? ';' : '';
        currentPallet.qrData += sep + qrCodes.join(';');
      }
    }
  }

  return results;
}
