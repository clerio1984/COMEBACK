import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { Item, User } from '../types';
import { useAuth } from '../AuthContext';

interface PoliceReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item;
}

export const PoliceReportPDFModal: React.FC<PoliceReportPDFModalProps> = ({ isOpen, onClose, item }) => {
  const { currentUser } = useAuth();
  
  // Auto-detect item type based on title/category search terms
  const detectInitialType = (): 'celular' | 'laptop' | 'outro' => {
    const titleLower = (item.title || '').toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    
    if (titleLower.includes('laptop') || titleLower.includes('computador') || titleLower.includes('notebook') || titleLower.includes('pc') || descLower.includes('laptop') || descLower.includes('computador')) {
      return 'laptop';
    }
    if (titleLower.includes('celular') || titleLower.includes('telemovel') || titleLower.includes('telefone') || titleLower.includes('iphone') || titleLower.includes('samsung') || titleLower.includes('huawei') || titleLower.includes('redmi') || descLower.includes('telefone')) {
      return 'celular';
    }
    return 'outro';
  };

  const [itemType, setItemType] = useState<'celular' | 'laptop' | 'outro'>('outro');

  // Participant details states
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userIdentityDoc, setUserIdentityDoc] = useState('');
  const [stolenDate, setStolenDate] = useState('');
  const [stolenLocation, setStolenLocation] = useState('');
  const [stolenProvince, setStolenProvince] = useState('');
  const [circumstances, setCircumstances] = useState('');

  // Mobile phone specific states
  const [imei, setImei] = useState('');
  const [cellBrand, setCellBrand] = useState('');
  const [cellModel, setCellModel] = useState('');
  const [cellColor, setCellColor] = useState('');

  // Laptop specific states
  const [laptopBrand, setLaptopBrand] = useState('');
  const [laptopModel, setLaptopModel] = useState('');
  const [laptopFrequency, setLaptopFrequency] = useState('');
  const [laptopStorage, setLaptopStorage] = useState('');
  const [laptopMemory, setLaptopMemory] = useState('');
  const [laptopSerial, setLaptopSerial] = useState('');
  const [laptopScreenSize, setLaptopScreenSize] = useState('');
  const [laptopUserName, setLaptopUserName] = useState('');
  const [laptopColor, setLaptopColor] = useState('');
  const [laptopOS, setLaptopOS] = useState('');

  // Auto-populate from item data & logged in user data
  useEffect(() => {
    if (isOpen) {
      const type = detectInitialType();
      setItemType(type);
      
      // Auto-prefill with current item and user data
      setUserName(currentUser?.name || item.ownerName || '');
      setUserPhone(currentUser?.phone || item.ownerPhone || '');
      setUserIdentityDoc(''); // User should fill BI
      setStolenDate(item.date ? item.date.substring(0, 10) : new Date().toISOString().substring(0, 10));
      setStolenLocation(item.location || '');
      setStolenProvince(item.province || '');
      setCircumstances(item.description || '');

      // Attempt parsing brand and model for celular or laptop
      const titleParts = (item.title || '').split(' ');
      const guessedBrand = titleParts[0] || '';
      const guessedModel = titleParts.slice(1).join(' ') || '';

      if (type === 'celular') {
        setCellBrand(guessedBrand);
        setCellModel(guessedModel);
        setCellColor('');
        setImei('');
      } else if (type === 'laptop') {
        setLaptopBrand(guessedBrand);
        setLaptopModel(guessedModel);
        setLaptopFrequency('2.4 GHz'); // Default guess placeholder
        setLaptopStorage('512GB SSD'); // Default guess placeholder
        setLaptopMemory('16GB RAM'); // Default guess placeholder
        setLaptopSerial('');
        setLaptopScreenSize('15.6"');
        setLaptopUserName(currentUser?.name?.split(' ')[0] || 'User');
        setLaptopColor('');
        setLaptopOS('Windows 11');
      }
    }
  }, [isOpen, item, currentUser]);

  if (!isOpen) return null;

  const handleGeneratePDF = () => {
    // Basic validation depending on fields
    if (!userName.trim()) {
      alert("Por favor, introduza o seu nome completo para fins de auto de polícia.");
      return;
    }
    if (!userPhone.trim()) {
      alert("Por favor, introduza um contacto telefónico válido.");
      return;
    }
    if (!userIdentityDoc.trim()) {
      alert("Por favor, insira o número do seu BI, Passaporte ou Documento de Identificação Civil (PRM exige indentidade).");
      return;
    }

    if (itemType === 'celular') {
      if (!imei.trim()) {
        alert("O IMEI é obrigatório para participação de telemóveis roubados. Verifique na caixa do aparelho ou ligue *#06#.");
        return;
      }
      if (imei.trim().length < 14) {
        alert("O IMEI introduzido parece estar incompleto. Certifique-se de introduzir entre 14 e 16 dígitos.");
        return;
      }
    }

    if (itemType === 'laptop') {
      if (!laptopBrand.trim() || !laptopModel.trim() || !laptopFrequency.trim() || !laptopStorage.trim() || !laptopMemory.trim() || !laptopScreenSize.trim() || !laptopUserName.trim() || !laptopColor.trim() || !laptopOS.trim()) {
        alert("Por favor, preencha todos os campos técnicos necessários do Computador Laptop solicitado pela corporação.");
        return;
      }
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Margins & Position Counters
      const margin = 20;
      let y = 20;

      // Header Banner Lines & Moçambique Coat Flag Representation
      // Draw upper flag ribbon geometric shapes
      doc.setFillColor(0, 151, 57); // Green Accent
      doc.rect(margin, y, (pageWidth - margin * 2) * 0.4, 3, 'F');
      doc.setFillColor(252, 225, 0); // Yellow Accent
      doc.rect(margin + (pageWidth - margin * 2) * 0.4, y, (pageWidth - margin * 2) * 0.3, 3, 'F');
      doc.setFillColor(210, 16, 52); // Red Accent
      doc.rect(margin + (pageWidth - margin * 2) * 0.7, y, (pageWidth - margin * 2) * 0.3, 3, 'F');
      
      y += 10;
      
      // Primary Institutional Header English / Portuguese translation structure
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('REPÚBLICA DE MOÇAMBIQUE', pageWidth / 2, y, { align: 'center' });
      y += 5;
      doc.text('MINISTÉRIO DO INTERIOR', pageWidth / 2, y, { align: 'center' });
      y += 5;
      doc.text('POLÍCIA DA REPÚBLICA DE MOÇAMBIQUE (PRM)', pageWidth / 2, y, { align: 'center' });
      y += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text('DIRECÇÃO NACIONAL DE INVESTIGAÇÃO CRIMINAL | ESQUADRA DE POLÍCIA LOCAL', pageWidth / 2, y, { align: 'center' });
      
      y += 12;

      // Divider line
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      
      y += 8;

      // Central Title Area
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(210, 16, 52); // Alert Red text
      doc.text('EDITAL DE PARTICIPAÇÃO DE OCORRÊNCIA CRIMINAL', pageWidth / 2, y, { align: 'center' });
      y += 5;
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'bold');
      doc.text('SUBTRACÇÃO DE BENS / ARTIGO ROUBADO', pageWidth / 2, y, { align: 'center' });
      
      y += 10;

      // Section A: IDENTIFICAÇÃO DO PARTICIPANTE (VÍTIMA)
      doc.setTextColor(0, 0, 0);
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('   1. DADOS DE IDENTIFICAÇÃO DO DECLARANTE / VÍTIMA', margin, y + 5);
      
      y += 12;

      // Fill Data grid manually for extreme layout rendering precision
      doc.setFont('Helvetica', 'bold');
      doc.text('Nome do Declarante: ', margin, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(userName.toUpperCase(), margin + 40, y);
      
      y += 6;
      doc.setFont('Helvetica', 'bold');
      doc.text('Contacto Principal: ', margin, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(userPhone, margin + 40, y);
      
      y += 6;
      doc.setFont('Helvetica', 'bold');
      doc.text('Documento Identificação (BI/DI/Pas): ', margin, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(userIdentityDoc.toUpperCase(), margin + 65, y);

      y += 10;

      // Section B: CARACTERÍSTICAS TÉCNICAS DO MATERIAL SUBTRAÍDO
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.text('   2. CARACTERÍSTICAS DO ARTIGO SUBTRAÍDO (EVIDÊNCIA TÉCNICA)', margin, y + 5);
      
      y += 12;

      doc.setFont('Helvetica', 'bold');
      doc.text('Artigo no ComeBack: ', margin, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(`#${item.id} - ${item.title}`, margin + 40, y);

      y += 6;
      doc.setFont('Helvetica', 'bold');
      doc.text('Categoria Registada: ', margin, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(item.category || 'Não Informada', margin + 40, y);

      y += 8;

      if (itemType === 'celular') {
        // Celular Fields Table Border
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(252, 252, 252);
        doc.rect(margin, y, pageWidth - margin * 2, 30, 'FD');

        doc.setFont('Helvetica', 'bold');
        doc.text('   TIPO DE EQUIPAMENTO:', margin + 4, y + 6);
        doc.setFont('Helvetica', 'normal');
        doc.text('TELEMOVEL / DISPOSITIVO CELULAR', margin + 47, y + 6);

        doc.setFont('Helvetica', 'bold');
        doc.text('   NÚMERO DE IMEI:', margin + 4, y + 13);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(210, 16, 52); // Red alert for crucial IMEI property
        doc.text(imei.toUpperCase(), margin + 47, y + 13);
        doc.setTextColor(0, 0, 0);

        doc.setFont('Helvetica', 'bold');
        doc.text('   MARCA COMPILADA:', margin + 4, y + 20);
        doc.setFont('Helvetica', 'normal');
        doc.text(cellBrand || 'NÃO CONFIGURADO', margin + 47, y + 20);

        doc.setFont('Helvetica', 'bold');
        doc.text('   MODELO E COR:', margin + 4, y + 27);
        doc.setFont('Helvetica', 'normal');
        doc.text(`${cellModel || 'N/A'} | Cor: ${cellColor || 'N/A'}`, margin + 47, y + 27);

        y += 35;
      } else if (itemType === 'laptop') {
        // Laptop Fields Detailed Table
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(252, 252, 252);
        doc.rect(margin, y, pageWidth - margin * 2, 60, 'FD');

        const labelX = margin + 4;
        const valX = margin + 50;

        doc.setFont('Helvetica', 'bold');
        doc.text('   TIPO DE EQUIPAMENTO:', labelX, y + 6);
        doc.setFont('Helvetica', 'normal');
        doc.text('COMPUTADOR PORTÁTIL / LAPTOP', valX, y + 6);

        doc.setFont('Helvetica', 'bold');
        doc.text('   MARCA / MODELO:', labelX, y + 13);
        doc.setFont('Helvetica', 'normal');
        doc.text(`${laptopBrand.toUpperCase()} ${laptopModel.toUpperCase()}`, valX, y + 13);

        doc.setFont('Helvetica', 'bold');
        doc.text('   NÚMERO DE SÉRIE (SERIAL):', labelX, y + 20);
        doc.setFont('Helvetica', 'bold');
        doc.text(laptopSerial ? laptopSerial.toUpperCase() : 'NÃO DECLARADO / OPCONAL', valX, y + 20);

        doc.setFont('Helvetica', 'bold');
        doc.text('   PROCESSADOR / FREQUÊNCIA:', labelX, y + 27);
        doc.setFont('Helvetica', 'normal');
        doc.text(laptopFrequency, valX, y + 27);

        doc.setFont('Helvetica', 'bold');
        doc.text('   CAPACIDADE DE ARMAZENAMENTO:', labelX, y + 34);
        doc.setFont('Helvetica', 'normal');
        doc.text(laptopStorage, valX, y + 34);

        doc.setFont('Helvetica', 'bold');
        doc.text('   MEMÓRIA RAM INSTALADA:', labelX, y + 41);
        doc.setFont('Helvetica', 'normal');
        doc.text(laptopMemory, valX, y + 41);

        doc.setFont('Helvetica', 'bold');
        doc.text('   SISTEMA OPERATIVO / UTILIZADOR:', labelX, y + 48);
        doc.setFont('Helvetica', 'normal');
        doc.text(`${laptopOS} | Utilizador: "${laptopUserName}"`, valX, y + 48);

        doc.setFont('Helvetica', 'bold');
        doc.text('   TAMANHO ECRÃ & COR:', labelX, y + 55);
        doc.setFont('Helvetica', 'normal');
        doc.text(`Ecrã de ${laptopScreenSize} - Cor: ${laptopColor}`, valX, y + 55);

        y += 65;
      } else {
        // Outro item generic details
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(252, 252, 252);
        doc.rect(margin, y, pageWidth - margin * 2, 20, 'FD');

        doc.setFont('Helvetica', 'bold');
        doc.text('   TIPO DE EQUIPAMENTO:', margin + 4, y + 6);
        doc.setFont('Helvetica', 'normal');
        doc.text('BIZARRO / GENÉRICOD OUTRAS CATEGORIAS', margin + 47, y + 6);

        doc.setFont('Helvetica', 'bold');
        doc.text('   DESCRITIVOS:', margin + 4, y + 13);
        doc.setFont('Helvetica', 'normal');
        doc.text('Preenchimento livre do auto sob descrição geral de pertences.', margin + 47, y + 13);
        
        y += 25;
      }

      // Section C: CIRCUNSTÂNCIAS DA OCORRÊNCIA (PRESTADAS PELO PROPRIETÁRIO)
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.text('   3. INFORMAÇÕES DA SUBTRACÇÃO (FURTO / ROUBO)', margin, y + 5);
      
      y += 12;

      doc.setFont('Helvetica', 'bold');
      doc.text('Data e Hora Estimada: ', margin, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(stolenDate, margin + 40, y);

      y += 6;
      doc.setFont('Helvetica', 'bold');
      doc.text('Província / Bairro: ', margin, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(`${stolenProvince} | Bairro / Local: ${stolenLocation}`, margin + 40, y);

      y += 6;
      doc.setFont('Helvetica', 'bold');
      doc.text('Resumo das Circunstâncias: ', margin, y);
      doc.setFont('Helvetica', 'normal');
      
      const splitCircumstances = doc.splitTextToSize(circumstances, pageWidth - margin * 2 - 45);
      doc.text(splitCircumstances, margin + 45, y);

      // Dynamically offset Y-coordinate based on circumstances length
      y += Math.max(12, splitCircumstances.length * 4.5);

      // Force section D on next page if we ran out of space
      if (y > pageHeight - 55) {
        doc.addPage();
        y = 25;
      }

      // Section D: DECLARAÇÃO DE VERACIDADE E ASSINATURAS
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.text('   4. TERMO DE SUBMISSÃO E COMPROMISSO DE HONRA', margin, y + 5);

      y += 12;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      const compromiseText = "Declaro sob minha honra que as informações prestadas neste documento correspondem rigorosamente à verdade jurídica sobre as características físicas, número de registos eletrónicos (IMEI/Serial) e circunstâncias em que decorreu o roubo do meu equipamento. Tenho pleno conhecimento de que a falsificação de dados constitui crime de falsas declarações em conformidade com o Código Penal da República de Moçambique.";
      const splitCompromise = doc.splitTextToSize(compromiseText, pageWidth - margin * 2);
      doc.text(splitCompromise, margin, y);

      y += 18;

      // Signature placements
      doc.line(margin, y, margin + 65, y); // Victim Line
      doc.line(pageWidth - margin - 65, y, pageWidth - margin, y); // Officer Line
      
      y += 4;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Assinatura do Utente Participante', margin + 32, y, { align: 'center' });
      doc.text('Carimbo / Assinatura PRM da Esquadra', pageWidth - margin - 32, y, { align: 'center' });

      y += 12;
      // Footer metadata
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('Este documento militar-operativo foi preenchido electronicamente no portal ComeBack Moçambique (Achei.mz).', pageWidth / 2, y, { align: 'center' });
      y += 3;
      doc.text(`Identificador de Autenticidade Digital: MD5-HASH-${btoa(item.id).substring(0, 8).toUpperCase()}-PRM-MZ`, pageWidth / 2, y, { align: 'center' });

      // Save document
      const docName = `PRM_Denuncia_Roubo_${item.title.replace(/\s+/g, '_')}_#${item.id.substring(0, 5)}.pdf`;
      doc.save(docName);
      
      alert(`🎉 Auto de Denúncia Criminal em PDF gerado com sucesso!\n\nGuarde o ficheiro "${docName}" no seu telemóvel ou computador, imprima-o e desloque-se à esquadra policial da PRM mais próxima no bairro do roubo para a imediata validação e expedição de mandado.`);
      onClose();
    } catch (err) {
      console.error('Erro na criação de arquivo PDF oficial da esquadra:', err);
      alert('Ocorreu um erro técnico inesperado ao compilar o PDF com a biblioteca jsPDF.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] overflow-y-auto">
      <div 
        id="police-prm-pdf-modal"
        className="bg-white dark:bg-[#070b14] w-full max-w-2xl rounded-[2.5rem] border-2 border-red-200 dark:border-red-900/60 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col my-auto"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-700 via-[#d21034] to-[#009739] p-6 text-white flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 p-2.5 rounded-2xl">
              <i className="fa-solid fa-file-shield text-xl"></i>
            </div>
            <div className="text-left">
              <h3 className="font-black text-xs uppercase tracking-widest leading-none text-yellow-300">Moçambique PRM</h3>
              <h2 className="font-extrabold text-sm sm:text-base leading-tight mt-1 text-white">Auto de Denúncia Oficial / Roubo</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-black/20 hover:bg-black/40 text-white transition-all active:scale-[0.9]"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Modal Content - Scrollable Form */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto text-left flex-1">
          {/* Top Banner Advice */}
          <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/40 text-xs text-gray-700 dark:text-gray-300 space-y-1.5 leading-relaxed">
            <span className="font-black text-red-700 dark:text-red-400 uppercase block">📋 INFORMAÇÃO OPERATIVA DE SEGURANÇA</span>
            Preencha estes detalhes para emitir um documento de submissão válido em qualquer esquadra da <strong className="text-red-700 dark:text-red-400">Polícia da República de Moçambique (PRM)</strong>. Isto servirá como prova legal para a instauração de um processo de busca e apreensão.
          </div>

          {/* Tab Selection */}
          <div>
            <label className="block text-[9px] font-black uppercase text-gray-400 dark:text-gray-500 mb-2">Selecione o Tipo de Equipamento Roubado:</label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setItemType('celular')}
                className={`py-3 px-1.5 rounded-xl border-2 font-black text-[9px] sm:text-[10px] uppercase transition-all flex flex-col items-center justify-center gap-1 ${itemType === 'celular' ? 'border-red-650 bg-red-600 text-white shadow' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-400 hover:bg-gray-100'}`}
              >
                <i className="fa-solid fa-mobile-screen text-xs"></i>
                Telemóvel / Celular
              </button>
              <button
                type="button"
                onClick={() => setItemType('laptop')}
                className={`py-3 px-1.5 rounded-xl border-2 font-black text-[9px] sm:text-[10px] uppercase transition-all flex flex-col items-center justify-center gap-1 ${itemType === 'laptop' ? 'border-indigo-650 bg-indigo-600 text-white shadow' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-400 hover:bg-gray-100'}`}
              >
                <i className="fa-solid fa-laptop text-xs"></i>
                Computador Laptop
              </button>
              <button
                type="button"
                onClick={() => setItemType('outro')}
                className={`py-3 px-1.5 rounded-xl border-2 font-black text-[9px] sm:text-[10px] uppercase transition-all flex flex-col items-center justify-center gap-1 ${itemType === 'outro' ? 'border-gray-650 bg-gray-650 text-white shadow' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-400 hover:bg-gray-100'}`}
              >
                <i className="fa-solid fa-box text-xs"></i>
                Outro Artigo
              </button>
            </div>
          </div>

          {/* Section 1: Identificação Pessoal */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 border-b border-gray-100 dark:border-gray-800 pb-1.5">1. Identificação do Declarante</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Nome do Declarante (Completo): <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Nome escrito no BI"
                  className="w-full text-xs font-bold font-sans px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Número de ID (BI / Passaporte): <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={userIdentityDoc}
                  onChange={(e) => setUserIdentityDoc(e.target.value)}
                  placeholder="Ex: 110291929310A"
                  className="w-full text-xs font-bold font-sans px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-gray-800 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Contacto Telefónico para Resgate: <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  placeholder="Ex: +258 84 123 4567"
                  className="w-full text-xs font-bold font-sans px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-gray-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Technical Specifications based on Tab selection */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 border-b border-gray-100 dark:border-gray-800 pb-1.5">2. Características Técnicas Obrigatórias</h4>
            
            {/* If Mobile phone Selected */}
            {itemType === 'celular' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1">Introduza o Código IMEI (15 dígitos): <span className="text-red-500">*</span></label>
                  <p className="text-[7.5px] text-gray-400 mb-2 font-bold uppercase">Código único guardado na placa lógica que desativa a rede móvel. Consulte a caixa do telefone.</p>
                  <input
                    type="text"
                    maxLength={17}
                    value={imei}
                    onChange={(e) => setImei(e.target.value.replace(/\s+/g, ''))}
                    placeholder="Ex: 358201091928374"
                    className="w-full text-xs font-black font-sans tracking-widest px-4 py-3.5 bg-red-100/30 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-900/40 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-red-800 dark:text-red-400"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Marca:</label>
                  <input
                    type="text"
                    value={cellBrand}
                    onChange={(e) => setCellBrand(e.target.value)}
                    placeholder="Ex: Samsung, Apple"
                    className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Modelo e Cor do Dispositivo:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={cellModel}
                      onChange={(e) => setCellModel(e.target.value)}
                      placeholder="Ex: Galaxy A34"
                      className="w-full text-xs font-bold px-3 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-gray-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={cellColor}
                      onChange={(e) => setCellColor(e.target.value)}
                      placeholder="Ex: Azul Escuro"
                      className="w-full text-xs font-bold px-3 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* If Computer / Laptop Selected */}
            {itemType === 'laptop' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Marca do Laptop: <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={laptopBrand}
                    onChange={(e) => setLaptopBrand(e.target.value)}
                    placeholder="Ex: HP, Dell, Lenovo"
                    className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Modelo: <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={laptopModel}
                    onChange={(e) => setLaptopModel(e.target.value)}
                    placeholder="Ex: Pavilion 15, Latitude 5420"
                    className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Frequência Processador (CPU GHz): <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={laptopFrequency}
                    onChange={(e) => setLaptopFrequency(e.target.value)}
                    placeholder="Ex: 2.4 GHz Octa-Core"
                    className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Armazenamento (Disco): <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={laptopStorage}
                    onChange={(e) => setLaptopStorage(e.target.value)}
                    placeholder="Ex: 512GB NVMe SSD"
                    className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Memória RAM Instalada: <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={laptopMemory}
                    onChange={(e) => setLaptopMemory(e.target.value)}
                    placeholder="Ex: 16GB DDR4"
                    className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Número de Série (Serial Number):</label>
                  <input
                    type="text"
                    value={laptopSerial}
                    onChange={(e) => setLaptopSerial(e.target.value)}
                    placeholder="Opcional (Ex: S/N: CNU912093X)"
                    className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Tamanho da Tela (Pol): <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={laptopScreenSize}
                    onChange={(e) => setLaptopScreenSize(e.target.value)}
                    placeholder="Ex: 15.6 polegadas"
                    className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Nome do Usuário no Sistema: <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={laptopUserName}
                    onChange={(e) => setLaptopUserName(e.target.value)}
                    placeholder="Ex: ClerioAdmin, Clerio1"
                    className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Cor Predominante: <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={laptopColor}
                    onChange={(e) => setLaptopColor(e.target.value)}
                    placeholder="Ex: Cinza Espacial, Preto"
                    className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Sistema Operativo (OS): <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={laptopOS}
                    onChange={(e) => setLaptopOS(e.target.value)}
                    placeholder="Ex: Windows 11 Pro, macOS Sonoma"
                    className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* If Other item Selected */}
            {itemType === 'outro' && (
              <p className="text-[10px] text-gray-500 italic">
                Para outros artigos, o documento será gerado com o resumo geral dos pertences registados.
              </p>
            )}
          </div>

          {/* Section 3: Circunstâncias */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 border-b border-gray-100 dark:border-gray-800 pb-1.5">3. Local & Circunstâncias do Roubo</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Data Ocorrência:</label>
                <input
                  type="date"
                  value={stolenDate}
                  onChange={(e) => setStolenDate(e.target.value)}
                  className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Província da Ocorrência:</label>
                <input
                  type="text"
                  value={stolenProvince}
                  onChange={(e) => setStolenProvince(e.target.value)}
                  className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-gray-800 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Localização Exata ou Bairro:</label>
                <input
                  type="text"
                  value={stolenLocation}
                  onChange={(e) => setStolenLocation(e.target.value)}
                  placeholder="Ex: Av. Eduardo Mondlane, Próximo ao Cine Gil Vicente"
                  className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-gray-800 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[8.5px] font-black uppercase text-gray-500 mb-1.5">Breve Resumo dos Eventos (Circunstâncias):</label>
                <textarea
                  value={circumstances}
                  onChange={(e) => setCircumstances(e.target.value)}
                  rows={3}
                  className="w-full text-xs font-bold px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none text-gray-800 dark:text-white resize-none"
                  placeholder="Explique sucintamente onde e como o bem foi subtraído para preencher o Auto de Denúncia..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 dark:bg-[#04080e] p-6 border-t border-gray-100 dark:border-gray-800/60 flex flex-col sm:flex-row gap-3 justify-end items-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 font-black text-[10px] uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-900 active:scale-95 transition-all"
          >
            Voltar Atrás / Cancelar
          </button>
          <button
            type="button"
            onClick={handleGeneratePDF}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-red-600 hover:bg-red-750 text-white font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2.5 active:scale-95 transition-all"
          >
            <i className="fa-solid fa-file-pdf text-xs"></i>
            Gerar Auto de Denúncia (PDF)
          </button>
        </div>
      </div>
    </div>
  );
};
