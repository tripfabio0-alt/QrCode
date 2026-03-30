import * as XLSX from 'xlsx';
import type { PalletData } from './pdf-processor';

export function exportToExcel(data: PalletData[], filename = 'pallets_export.xlsx') {
  const rows: any[][] = [];

  // Configuração global: Headers
  rows.push([
    'Pallet (Volume)',
    'Quantidade',
    'Referência',
    'Descrição',
    'Nota Fiscal',
    'Pedido Zenner',
    'Ordem de Compra',
  ]);

  for (const item of data) {
    // 1) Linha com as informações do pallet
    rows.push([
      item.palletInfo.volume,
      item.palletInfo.quantidade,
      item.palletInfo.referencia,
      item.palletInfo.descricao,
      item.palletInfo.notaFiscal,
      item.palletInfo.pedidoZenner,
      item.palletInfo.ordemCompra,
    ]);

    // Linha em branco para separar as informações principais do grid de seriais
    rows.push([]);

    // 2) Quebrar os QR codes por ponto e vírgula e remover vazios
    const serials = item.qrData
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // 3) Construir um grid de 6 linhas x N colunas
    // Como os dados preenchem primeiro a coluna inteira para baixo (linhas 0 a 5), depois mudam de coluna:
    // arrayIndex = col * 6 + row
    const numRows = 6;
    const numCols = Math.ceil(serials.length / numRows);
    
    // Inicializa 6 linhas vazias para este bloco de QR Codes
    const gridRows: string[][] = Array.from({ length: numRows }, () => new Array(numCols).fill(''));

    for (let i = 0; i < serials.length; i++) {
      const col = Math.floor(i / numRows);
      const row = i % numRows;
      gridRows[row][col] = serials[i];
    }

    // Adiciona as 6 linhas geradas na planilha principal
    rows.push(...gridRows);
    
    // Adiciona uma linha em branco para separar os pallets visualmente
    rows.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  
  // Set column widths. Since we can have up to 20 cols, we provide some default widths.
  // The first 7 cols correspond to the pallet headers, but they also share space with the serial grid later.
  ws['!cols'] = [
    { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 35 },
    { wch: 12 }, { wch: 14 }, { wch: 15 }, ...Array(15).fill({ wch: 16 })
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pallets');
  
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const url = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + wbout;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
