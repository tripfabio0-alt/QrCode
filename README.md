# Leitor de QR dos Pallets

Aplicação Web profissional para processamento e leitura automática de metadados e centenas de QR Codes de etiquetas de pallets em formato PDF.

## 🚀 Funcionalidades Principais
- **Processamento Dinâmico de PDF**: Leitura contínua que identifica autonomamente a página "Capa" contendo os dados do Pallet e agrupa todas as páginas subsequentes contendo QR Codes a ele.
- **Extração com Precisão Y-Axis**: Algoritmo vetorial sob medida para garantir a quebra de linha correta em campos frágeis de etiquetas (como Referência e Ordem de Compra).
- **Varredura Multi-QR**: Engine otimizada que funde a leitura do `pdf-js` em um quadro Canvas usando "borracha de pixels" iterativa do `jsQR`, garantindo que nenhnum QR Code escape, seja 1 ou 120 códigos na mesma página.
- **Auditoria de Divergência**: Validação cruzada com arquivo-base local (`.txt` ou `.csv`). O sistema separa visualmente os itens em: *Faltantes no PDF*, *Sobrando no PDF* e *Cadastros Duplicados*.
- **Planilha Excel Higienizada e Segura**: Exportação bypass via Base64 Injection que impede os bloqueios corporativos de navegador, gerando o formato amigável perfeitamente desenhado em um *grid de 6 linhas e 20 colunas*.

## 🛠️ Tecnologias
- **Frontend**: React 18, Vite, TypeScript, TailwindCSS
- **Componentes Visuais**: `shadcn/ui` + ícones dinâmicos `lucide-react`
- **Manipulação de PDF**: `pdfjs-dist` (Renderização via Cloudflare worker)
- **Scanner Matrix**: `jsQR` (varredura profunda baseada em inversões e densidade)
- **Data Export**: `xlsx` (SheetJS)

## 📦 Como rodar localmente
1. Instale as dependências:
```bash
npm install
```
2. Inicialize o servidor local de desenvolvimento:
```bash
npm run dev
```
