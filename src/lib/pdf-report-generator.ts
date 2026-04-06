import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface AuditReportData {
  results: any[];
  fileName: string;
  csvFileName: string;
  validationParams: {
    globalDuplicates: Set<string>;
    missingInCsv: Set<string>;
    missingInPdf: Set<string>;
    hasGlobalErrors: boolean;
    totalPdfSerials: number;
  };
  csvDuplicates: string[];
}

export const generateAuditReport = (data: AuditReportData) => {
  const { results, fileName, csvFileName, validationParams, csvDuplicates } = data;
  const doc = new jsPDF();
  const dateStr = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });

  // Header Title
  doc.setFontSize(20);
  doc.setTextColor(40);
  doc.text("RECIBO DE AUDITORIA DE LOTE", 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Sistema Universal de Captura e Validação de Pallets", 105, 27, { align: 'center' });
  
  // Date and Metadata Box
  doc.setDrawColor(200);
  doc.line(20, 35, 190, 35);
  
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(`Data/Hora: ${dateStr}`, 20, 45);
  doc.text(`Arquivo PDF: ${fileName || 'N/A'}`, 20, 52);
  doc.text(`Base Referência: ${csvFileName || 'Não fornecida'}`, 20, 59);

  // Resume Stats
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo da Auditoria", 20, 75);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total de Pallets: ${results.length}`, 20, 82);
  doc.text(`Aparelhos Identificados: ${validationParams.totalPdfSerials}`, 20, 87);

  // Conclusion Status Box
  const statusY = 95;
  const hasErrors = validationParams.hasGlobalErrors || csvDuplicates.length > 0;
  const isComplete = csvFileName !== '';

  if (!isComplete) {
    doc.setFillColor(240, 240, 240);
    doc.rect(20, statusY, 170, 15, 'F');
    doc.setTextColor(100);
    doc.setFont("helvetica", "bold");
    doc.text("CONFERÊNCIA INCOMPLETA (SEM BASE MESTRE)", 105, statusY + 10, { align: 'center' });
  } else if (!hasErrors) {
    doc.setFillColor(230, 255, 230);
    doc.rect(20, statusY, 170, 15, 'F');
    doc.setTextColor(0, 128, 0);
    doc.setFont("helvetica", "bold");
    doc.text("VALIDEZ COMPROVADA - NENHUMA DIVERGÊNCIA", 105, statusY + 10, { align: 'center' });
  } else {
    doc.setFillColor(255, 230, 230);
    doc.rect(20, statusY, 170, 15, 'F');
    doc.setTextColor(180, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("DIVERGÊNCIAS DETECTADAS NA AUDITORIA", 105, statusY + 10, { align: 'center' });
  }

  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");

  // Error Table Header
  let currentY = statusY + 25;

  if (hasErrors) {
    const errorRows = [];

    if (validationParams.globalDuplicates.size > 0) {
      errorRows.push(["Duplicidades no Lote (PDF)", Array.from(validationParams.globalDuplicates).join(', ')]);
    }
    if (validationParams.missingInCsv.size > 0) {
      errorRows.push(["Extrafísico (Sobrando no PDF)", Array.from(validationParams.missingInCsv).join(', ')]);
    }
    if (validationParams.missingInPdf.size > 0) {
      errorRows.push(["Omissão (Faltando no PDF)", Array.from(validationParams.missingInPdf).join(', ')]);
    }
    if (csvDuplicates.length > 0) {
      errorRows.push(["Erros na Base de Referência", csvDuplicates.join(', ')]);
    }

    if (errorRows.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [['Tipo de Ocorrência', 'Seriais Identificados']],
        body: errorRows,
        styles: { fontSize: 8, overflow: 'linebreak', cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
        headStyles: { fillColor: [180, 0, 0] },
      });
      currentY = (doc as any).lastAutoTable.finalY + 20;
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text("Todos os volumes físicos coincidem com a base vinculada no sistema.", 20, currentY);
    currentY += 20;
  }

  // Signature lines
  const pageHeight = doc.internal.pageSize.height;
  doc.setDrawColor(0);
  doc.line(60, pageHeight - 40, 150, pageHeight - 40);
  doc.setFontSize(10);
  doc.text("Assinatura do Auditor Analista", 105, pageHeight - 33, { align: 'center' });
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Gerado eletronicamente pelo Pallet Reader v1.0.2`, 20, pageHeight - 10);

  // Save the PDF
  const safeName = (fileName || 'relatorio').split('.')[0].replace(/[^a-z0-9]/gi, '_');
  doc.save(`Recibo_Auditoria_${safeName}_${format(new Date(), 'ddMMyy_HHmm')}.pdf`);
};
