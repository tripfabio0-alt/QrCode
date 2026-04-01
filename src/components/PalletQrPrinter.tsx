import { useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Printer, X, AlertCircle } from 'lucide-react';
import { type PalletData } from '@/lib/pdf-processor';

interface Props {
  results: PalletData[];
}

export function PalletQrPrinter({ results }: Props) {
  const [open, setOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  if (!open) {
    return (
      <Button 
        variant="outline" 
        className="gap-2 border-primary/20 hover:bg-primary/10 transition-colors shadow-sm" 
        onClick={() => setOpen(true)}
      >
        <Printer className="h-4 w-4" />
        Gerar QR Físicos
      </Button>
    );
  }

  // O Portal é utilizado para jogar a tela tela de impressão direto no body,
  // permitindo isolarmos apenas ela na hora que apertamos Ctrl+P
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto print:static print:block print:w-full print:h-auto print:overflow-visible">
      {/* CABEÇALHO (Não impresso) */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-border p-4 px-8 flex justify-between items-center shadow-sm print:hidden">
         <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black text-slate-800">Modo de Impressão (Alta Resolução)</h2>
            <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              Esses QRCodes utilizam nível baixo de Correção de Erro [L] e formato Vetorial [SVG] para maximizar leitura ótica.
            </p>
         </div>
         <div className="flex gap-4">
           <Button onClick={handlePrint} className="gap-2 shadow-md bg-blue-600 hover:bg-blue-700 text-white" size="lg">
             <Printer className="h-5 w-5" /> Imprimir Agora (Ctrl+P)
           </Button>
           <Button variant="outline" onClick={() => setOpen(false)} size="icon" className="h-11 w-11 rounded-full border-slate-300">
             <X className="h-6 w-6 text-slate-600" />
           </Button>
         </div>
      </div>

      {/* ÁREA CARREGAMENTO DE QRs */}
      <div className="max-w-5xl mx-auto p-12 print:p-0 print:max-w-none">
        
        {/* Usamos grid de 2 colunas para A4 cair perfeitamente (lado a lado) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 print:grid-cols-2 print:gap-x-6 print:gap-y-12 print:block">
          {results.map((r, i) => {
            const numPallet = r.palletInfo?.volume?.replace(/[^\d]/g, '') || String(i + 1);

            return (
              <div 
                key={i} 
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 bg-slate-50 rounded-2xl print:border-solid print:border-black print:bg-white print:-mb-[2px] print:rounded-3xl print:break-inside-avoid print:page-break-inside-avoid print:h-auto break-inside-avoid"
              >
                {/* 
                  O nível 'L' permite no máximo 7% de erro. Isso diminui os bytes extras de reparação, 
                  gerando QR Codes que são "pixels" maiores e menos densamente esmagados. 
                */}
                <QRCodeSVG
                  value={r.qrData}
                  size={320} 
                  level="L"
                  includeMargin={true}
                  className="print:w-[10cm] print:h-[10cm]"
                />
                
                <div className="mt-8 text-center flex flex-col gap-2">
                  <div className="font-extrabold font-mono text-4xl tracking-widest text-slate-900 print:text-5xl">
                    PALLET {numPallet}
                  </div>
                  <div className="text-slate-600 font-bold mt-2 text-xl print:text-2xl uppercase">
                    Ref: {r.palletInfo?.referencia || '?'}
                  </div>
                  <div className="text-slate-500 font-medium text-lg print:text-xl">
                    Total: {r.palletInfo?.quantidade || '?'} UNIDADES
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
