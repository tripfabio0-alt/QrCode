import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Upload, FileText, Download, Loader2, CheckCircle2, AlertCircle, Package, Check, AlertTriangle, FileSpreadsheet, XCircle, Scan, Trash2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { processPDF, type PalletData } from '@/lib/pdf-processor';
import { exportToExcel } from '@/lib/excel-export';
import { toast } from '@/hooks/use-toast';
import { generateAuditReport } from '@/lib/pdf-report-generator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PalletQrPrinter } from '@/components/PalletQrPrinter';

type Status = 'idle' | 'processing' | 'done' | 'error';

const Index = () => {
  // --- PDF State ---
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<PalletData[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [fileName, setFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // --- CSV / TXT Reference State ---
  const [csvData, setCsvData] = useState<string[] | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvDuplicates, setCsvDuplicates] = useState<string[]>([]);

  // --- Scanner State ---
  const [scannedSerials, setScannedSerials] = useState<string[]>([]);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast({ title: 'Erro', description: 'Por favor, envie um arquivo PDF.', variant: 'destructive' });
      return;
    }

    setFileName(file.name);
    setStatus('processing');
    setResults([]);
    setErrorMessage('');

    try {
      const data = await processPDF(file, (current, total) => {
        setProgress({ current, total });
      });
      setResults(data);
      setStatus('done');
      toast({ title: 'Sucesso!', description: `${data.length} pallets processados.` });
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || String(err));
      toast({ title: 'Falha no Processamento', description: 'Por favor, verifique os erros na tela.', variant: 'destructive' });
    }
  }, []);

  const handleCSV = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast({ title: 'Erro', description: 'Envie um arquivo de referência (.csv ou .txt) válido', variant: 'destructive' });
      return;
    }
    setCsvFileName(file.name);
    try {
      const { parseCSV } = await import('@/lib/csv-parser');
      const result = await parseCSV(file);
      setCsvData(result.uniqueSerials);
      setCsvDuplicates(result.duplicatedSerials);
      toast({ title: 'Arquivo Carregado', description: `${result.uniqueSerials.length} seriais únicos lidos da base.` });
    } catch(err: any) {
      toast({ title: 'Erro na Base de Referência', description: String(err), variant: 'destructive' });
    }
    // Reseta o valor para permitir re-upload do mesmo arquivo
    e.target.value = '';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleExport = () => {
    const cleanName = fileName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const name = cleanName + '_dados.xlsx';
    exportToExcel(results, name);
  };

  const handleResetPdf = () => {
    setStatus('idle');
    setResults([]);
    setProgress({ current: 0, total: 0 });
    setFileName('');
    setErrorMessage('');
  };

  // PDF Validation Logic
  const validationParams = useMemo(() => {
    const allPdfSerials = new Map<string, number[]>(); // serial -> indices of pallets containing it
    let totalPdfSerials = 0;
    
    results.forEach((p, idx) => {
      const serials = p.qrData.split(';').map(s => s.trim()).filter(s => s.length > 0);
      totalPdfSerials += serials.length;
      serials.forEach(s => {
        if (!allPdfSerials.has(s)) allPdfSerials.set(s, []);
        allPdfSerials.get(s)!.push(idx);
      });
    });

    const globalDuplicates = new Set<string>();
    const missingInCsv = new Set<string>();
    const missingInPdf = new Set<string>();

    for (const [serial, pallets] of allPdfSerials.entries()) {
      if (pallets.length > 1) globalDuplicates.add(serial);
      if (csvData && !csvData.includes(serial)) missingInCsv.add(serial);
    }

    if (csvData) {
      csvData.forEach(serial => {
        if (!allPdfSerials.has(serial)) missingInPdf.add(serial);
      });
    }

    const hasGlobalErrors = globalDuplicates.size > 0 || missingInCsv.size > 0 || missingInPdf.size > 0;

    return { allPdfSerials, globalDuplicates, missingInCsv, missingInPdf, hasGlobalErrors, totalPdfSerials };
  }, [results, csvData]);

  const getPalletStatus = (qrData: string, pIdx: number) => {
    const serials = qrData.split(';').map(s => s.trim()).filter(s => s.length > 0);
    const duplicates = serials.filter(s => validationParams.allPdfSerials.get(s)!.length > 1);
    const extraneos = csvData ? serials.filter(s => !csvData.includes(s)) : [];
    
    return { duplicates, extraneos, hasError: duplicates.length > 0 || extraneos.length > 0 };
  }

  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.currentTarget.value.trim();
      if (val && val.length >= 6) { 
        // Separa a string em múltiplos seriais caso seja o QR Code de um Pallet inteiro
        const serials = val.split(';').map(s => s.trim()).filter(s => s.length >= 6);
        
        if (serials.length > 0) {
          // Reverte os seriais ao juntar no histórico para que fiquem na ordem correta na visualização "mais recentes no topo"
          setScannedSerials(prev => [...serials.reverse(), ...prev]);
          if (serials.length > 1) {
            toast({ title: 'Lote Capturado!', description: `${serials.length} seriais adicionados da etiqueta.`, duration: 2500 });
          } else {
            toast({ title: 'Adicionado', description: serials[0], duration: 1500 });
          }
        }
      }
      e.currentTarget.value = '';
    }
  };

  const validationScanner = useMemo(() => {
    const globalDuplicates = new Set<string>();
    const missingInCsv = new Set<string>();
    const missingInScanner = new Set<string>();
    const seen = new Set<string>();

    scannedSerials.forEach(s => {
      if (seen.has(s)) globalDuplicates.add(s);
      seen.add(s);
    });

    if (csvData) {
      seen.forEach(serial => {
        if (!csvData.includes(serial)) missingInCsv.add(serial);
      });
      csvData.forEach(serial => {
        if (!seen.has(serial)) missingInScanner.add(serial);
      });
    }

    const hasGlobalErrors = globalDuplicates.size > 0 || missingInCsv.size > 0 || missingInScanner.size > 0;

    return { globalDuplicates, missingInCsv, missingInScanner, hasGlobalErrors };
  }, [scannedSerials, csvData]);

  const clearScanner = () => {
    if (confirm("Deseja realmente apagar todos os itens lidos e começar uma nova conferência?")) {
      setScannedSerials([]);
      setTimeout(() => scannerInputRef.current?.focus(), 100);
    }
  };

  const clearCsv = () => {
    setCsvData(null);
    setCsvFileName('');
    setCsvDuplicates([]);
  }

  const handleDownloadReport = () => {
    generateAuditReport({
      results,
      fileName,
      csvFileName,
      validationParams,
      csvDuplicates
    });
    toast({ title: 'Relatório Criado', description: 'O download deve começar automaticamente.' });
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Pallet Reader</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground">Sistema Universal de Captura e Validação Livre</p>
                <span className="text-[10px] font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border" title={`Última atualização: ${__BUILD_DATE__}`}>
                  v{__APP_VERSION__} • {__BUILD_DATE__.split(' ')[0]}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            {csvData ? (
              <span className="text-sm font-medium text-green-600 flex items-center bg-green-50 px-3 py-1 rounded-full border border-green-200">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Base Mestre Ativa ({csvData.length} medidores)
                <button onClick={clearCsv} className="ml-2 hover:bg-green-200 rounded p-1" title="Remover Base">
                  <XCircle className="h-3 w-3 text-green-700" />
                </button>
              </span>
            ) : (
              <label className="cursor-pointer text-sm font-medium bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded border border-primary/20 transition-colors flex items-center">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Importar (.txt / .csv) de Referência
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
              </label>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        
        <Tabs defaultValue="pdf" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8 rounded-xl h-12">
            <TabsTrigger value="pdf" className="text-sm rounded-lg h-9 data-[state=active]:shadow-sm">📄 Auditoria Lote PDF</TabsTrigger>
            <TabsTrigger value="scanner" className="text-sm rounded-lg h-9 data-[state=active]:shadow-sm">🔫 Conferência Física</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pdf" className="focus-visible:outline-none">
            {/* Upload Area */}
            {status === 'idle' && (
              <Card className="mx-auto max-w-xl border-2 border-dashed border-border shadow-none">
                <CardContent className="p-0">
                  <label
                    className={`flex cursor-pointer flex-col items-center gap-4 p-16 text-center transition-colors rounded-xl ${
                      dragActive ? 'bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={onDrop}
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                      <Upload className="h-10 w-10 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold">Arraste o PDF de Pallets aqui</p>
                      <p className="mt-1 text-sm text-muted-foreground">ou clique para selecionar o arquivo no computador</p>
                    </div>
                    <input type="file" accept=".pdf" className="hidden" onChange={onFileSelect} />
                  </label>
                </CardContent>
              </Card>
            )}

            {/* Processing */}
            {status === 'processing' && (
              <Card className="mx-auto max-w-xl">
                <CardContent className="flex flex-col items-center gap-4 p-8">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="font-semibold">Processando PDF...</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Página {progress.current} de {progress.total}
                    </p>
                  </div>
                  <Progress value={progressPercent} className="w-full mt-2" />
                </CardContent>
              </Card>
            )}

            {/* Error */}
            {status === 'error' && (
              <Card className="mx-auto max-w-xl border-destructive/30 bg-destructive/5">
                <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                  <div>
                    <p className="font-bold text-destructive text-lg">Erro no Processamento</p>
                    <p className="mt-2 text-sm max-w-md text-muted-foreground break-words">
                      {errorMessage || 'Ocorreu um erro desconhecido ao processar o PDF.'}
                    </p>
                  </div>
                  <Button onClick={handleResetPdf} variant="outline" className="mt-4 border-destructive/20 hover:bg-destructive/10">Tentar novamente com outro PDF</Button>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {status === 'done' && results.length > 0 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex justify-center items-center">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-bold text-lg leading-none">{results.length} Pallets Lidos</p>
                      <p className="text-sm text-muted-foreground mt-1">Total: {validationParams.totalPdfSerials} medidores</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    <Button variant="outline" onClick={handleResetPdf}>
                      Ler Outro PDF
                    </Button>
                    <PalletQrPrinter results={results} />
                    <Button onClick={handleExport} variant={validationParams.hasGlobalErrors && csvData ? "secondary" : "default"}>
                      <Download className="mr-2 h-4 w-4" /> Excel
                    </Button>
                    <Button onClick={handleDownloadReport} variant="default" className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Download className="mr-2 h-4 w-4" /> Baixar Relatório PDF
                    </Button>
                  </div>
                </div>

                {/* Validation Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-border shadow-sm bg-gradient-to-br from-card to-muted/20">
                    <CardHeader className="py-4">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className={`h-4 w-4 ${validationParams.globalDuplicates.size > 0 ? 'text-amber-500' : 'text-green-500'}`} />
                        Duplicidades no Lote (PDF)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-black tracking-tight">{validationParams.globalDuplicates.size}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className={`border-border shadow-sm bg-gradient-to-br from-card to-muted/20 ${!csvData ? 'opacity-50 grayscale' : ''}`}>
                    <CardHeader className="py-4">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <XCircle className={`h-4 w-4 ${validationParams.missingInCsv.size > 0 ? 'text-red-500' : 'text-green-500'}`} />
                        Fora do TXT (Físicos Sobrando)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-black tracking-tight">{csvData ? validationParams.missingInCsv.size : '-'}</p>
                    </CardContent>
                  </Card>

                  <Card className={`border-border shadow-sm bg-gradient-to-br from-card to-muted/20 ${!csvData ? 'opacity-50 grayscale' : ''}`}>
                    <CardHeader className="py-4">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <AlertCircle className={`h-4 w-4 ${validationParams.missingInPdf.size > 0 ? 'text-red-500' : 'text-green-500'}`} />
                        Faltando no PDF (Ausentes)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-black tracking-tight">{csvData ? validationParams.missingInPdf.size : '-'}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto rounded-xl">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-16 text-center">Status</TableHead>
                            <TableHead className="w-20">Pallet</TableHead>
                            <TableHead className="w-16">Qtd</TableHead>
                            <TableHead className="w-24">Ref.</TableHead>
                            <TableHead className="w-32">Série Inicial</TableHead>
                            <TableHead className="w-32">Série Final</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.map((item, idx) => {
                            const { duplicates, extraneos, hasError } = getPalletStatus(item.qrData, idx);
                            
                            return (
                              <TableRow key={idx} className={hasError ? "bg-red-50/30" : ""}>
                                <TableCell className="text-center">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        {hasError ? (
                                          <span className="flex h-3 w-3 rounded-full bg-red-500 mx-auto shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" />
                                        ) : (
                                          <span className="flex h-3 w-3 rounded-full bg-green-500 mx-auto" />
                                        )}
                                      </TooltipTrigger>
                                      {hasError && (
                                        <TooltipContent className="max-w-xs bg-destructive text-destructive-foreground border-destructive">
                                          {duplicates.length > 0 && (
                                            <div className="mb-2"><strong>Duplicados:</strong> {duplicates.join(', ')}</div>
                                          )}
                                          {extraneos.length > 0 && (
                                            <div><strong>Não estão no Arquivo Mestre:</strong> {extraneos.join(', ')}</div>
                                          )}
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                                <TableCell className="font-bold">{item.palletInfo.volume || '-'}</TableCell>
                                <TableCell>{item.palletInfo.quantidade || '-'}</TableCell>
                                <TableCell>{item.palletInfo.referencia || '-'}</TableCell>
                                <TableCell className="font-mono text-xs">{item.palletInfo.serieInicial || '-'}</TableCell>
                                <TableCell className="font-mono text-xs">{item.palletInfo.serieFinal || '-'}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Divergences List Table */}
                {(validationParams.hasGlobalErrors || csvDuplicates.length > 0) && (
                  <Card className="border-red-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-red-50/80 pb-4 border-b border-red-100">
                      <CardTitle className="text-base text-red-800 flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-3" />
                        Detalhamento das Divergências (Auditoria Ativa)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {validationParams.globalDuplicates.size > 0 && (
                          <div>
                            <h3 className="font-bold text-orange-900 text-sm mb-3">📦 Duplicidades Lidas nos Pallets</h3>
                            <div className="flex flex-wrap gap-2">
                              {Array.from(validationParams.globalDuplicates).map(s => (
                                <span key={s} className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded border border-orange-200 font-mono shadow-sm">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {validationParams.missingInCsv.size > 0 && (
                          <div>
                            <h3 className="font-bold text-amber-900 text-sm mb-3">⚠️ Seriais Físicos (Não cadastrados no Arquivo de Ref)</h3>
                            <div className="flex flex-wrap gap-2">
                              {Array.from(validationParams.missingInCsv).map(s => (
                                <span key={s} className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded border border-amber-200 font-mono shadow-sm">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {validationParams.missingInPdf.size > 0 && (
                          <div>
                            <h3 className="font-bold text-red-900 text-sm mb-3">❌ Cadastro Pendente (Faltam nos Pallets)</h3>
                            <div className="flex flex-wrap gap-2">
                              {Array.from(validationParams.missingInPdf).map(s => (
                                <span key={s} className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded border border-red-200 font-mono shadow-sm">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {csvDuplicates.length > 0 && (
                          <div>
                            <h3 className="font-bold text-purple-900 text-sm mb-3">🔁 Erros na Base TXT/CSV (Itens Repetidos)</h3>
                            <div className="flex flex-wrap gap-2">
                              {csvDuplicates.map(s => (
                                <span key={s} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded border border-purple-200 font-mono shadow-sm">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

              </div>
            )}
          </TabsContent>

          <TabsContent value="scanner" className="focus-visible:outline-none">
            <div className="flex flex-col items-center gap-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 mt-4">
              
              {/* O INPUT PRINCIPAL */}
              <Card className="w-full border-blue-200 shadow-md">
                <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-6 rounded-t-xl">
                  <CardTitle className="text-xl flex items-center justify-center gap-3 text-blue-900">
                    <Scan className="h-7 w-7 text-blue-600" />
                    Campo de Leitura e Bipagem (Scanner)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <Input 
                    ref={scannerInputRef} 
                    autoFocus 
                    onKeyDown={handleScannerKeyDown} 
                    placeholder="Deixe o cursor piscando aqui e dispare o código de barras ou bata Enter..." 
                    className="text-center text-lg h-16 shadow-inner bg-muted/20 border-2" 
                  />
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Toda leitura validada com 'Enter' entrará na contagem abaixo
                  </p>
                </CardContent>
              </Card>

              {/* Informações Visuais em Tempo Real */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {/* Painel Esquerdo: Contagem */}
                <div className="flex flex-col gap-6">
                  <Card className="shadow-sm">
                    <CardHeader className="py-4 bg-muted/20">
                      <CardTitle className="text-sm font-medium flex justify-between">
                        Contador da Sessão
                        <Button variant="ghost" size="sm" onClick={clearScanner} className="h-6 text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-4 w-4 mr-1"/> Limpar Tiros
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-6xl font-black tracking-tighter text-primary">{scannedSerials.length}</span>
                        {csvData && <span className="text-2xl text-muted-foreground font-semibold">/ {csvData.length} Mestre</span>}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="py-4 bg-muted/20 border-b">
                      <CardTitle className="text-sm font-medium">Histórico (Últimos tiros recebidos)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      {scannedSerials.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">Nenhum bipe registrado</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-[220px] overflow-y-auto content-start">
                          {scannedSerials.map((s, i) => (
                            <span 
                              key={i} 
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-800 text-xs rounded border border-slate-200 font-mono shadow-sm"
                              title={`Posição lida: ${scannedSerials.length - i}`}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Painel Direito: Dashboard Analítico */}
                <div className="flex flex-col h-full">
                  <Card className={`h-full shadow-sm ${validationScanner.hasGlobalErrors && csvData ? 'border-red-200' : 'border-green-200'}`}>
                    <CardHeader className={`py-4 border-b ${validationScanner.hasGlobalErrors && csvData ? 'bg-red-50/50 border-red-100' : 'bg-green-50/50 border-green-100'}`}>
                      <CardTitle className="text-sm font-bold flex items-center justify-between">
                        Resultado da Análise
                        {!validationScanner.hasGlobalErrors && csvData && (
                          <span className="bg-green-200 text-green-800 text-xs px-2 py-0.5 rounded flex items-center"><Check className="h-3 w-3 mr-1"/> Validado</span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 overflow-y-auto max-h-[400px]">
                      {!csvData ? (
                        <div className="text-center p-4 border-2 border-dashed rounded-xl mt-8">
                          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                          <p className="text-muted-foreground text-sm">Faça o upload do TXT/CSV da carga clicando no botão "Importar Mestre" acima para habilitar o comparador instantâneo.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-6">
                           {/* Erros Encontrados (Se houver) */}
                           {validationScanner.missingInCsv.size > 0 && (
                            <div>
                              <h3 className="font-bold text-amber-900 text-xs uppercase mb-2">⚠️ Extrafísico (Bipado mas não existe no TXT)</h3>
                              <div className="flex flex-wrap gap-1.5">
                                {Array.from(validationScanner.missingInCsv).map(s => (
                                  <span key={s} className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded border border-amber-200 font-mono shadow-sm">{s}</span>
                                ))}
                              </div>
                            </div>
                           )}

                           {validationScanner.missingInScanner.size > 0 && (
                            <div>
                              <h3 className="font-bold text-red-900 text-xs uppercase mb-2">❌ Omissão (Esqueceu de bipar no estoque)</h3>
                              <div className="flex flex-wrap gap-1.5">
                                {Array.from(validationScanner.missingInScanner).map(s => (
                                  <span key={s} className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[10px] rounded border border-red-200 font-mono shadow-sm">{s}</span>
                                ))}
                              </div>
                            </div>
                           )}

                           {(validationScanner.globalDuplicates.size > 0 || csvDuplicates.length > 0) && (
                            <div>
                              <h3 className="font-bold text-purple-900 text-xs uppercase mb-2">🔁 Duplicidade Detectada na Conferência</h3>
                              <div className="flex flex-wrap gap-1.5">
                                {Array.from(validationScanner.globalDuplicates).map(s => (
                                  <span key={s} className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] rounded border border-purple-200 font-mono shadow-sm">{s} (Bipado)</span>
                                ))}
                                {csvDuplicates.map(s => (
                                  <span key={s} className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] opacity-70 rounded border border-purple-200 font-mono shadow-sm">{s} (No Base)</span>
                                ))}
                              </div>
                            </div>
                           )}

                           {!validationScanner.hasGlobalErrors && scannedSerials.length > 0 && (
                             <div className="flex flex-col items-center justify-center p-8 bg-green-50/50 rounded-xl border border-green-100 mt-4">
                               <CheckCircle2 className="h-12 w-12 text-green-500 mb-2"/>
                               <p className="text-green-800 font-medium text-center">Bipagem totalmente imaculada até o presente momento!</p>
                             </div>
                           )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
