import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Scale, Barcode, DollarSign, History, TrendingUp, TrendingDown, 
  Settings, Bluetooth, BluetoothConnected, Plus, Wallet, 
  Search, Edit3, CheckCircle, Trash2, Printer,
  Home, PieChart, PackagePlus, Tag, QrCode,
  ChevronRight, ChevronDown, Usb, Wifi, MonitorSmartphone, Server,
  FileText, Users, UserPlus, Shield, Copy, Mail, Key, Power, PowerOff, X,
  LogOut, CalendarClock, RefreshCw, Download
} from 'lucide-react';

const INITIAL_SCRAPS = [
  { code: '001', name: 'Cobre Mel', price: 45.00 },
  { code: '002', name: 'Cobre Misto', price: 38.00 },
  { code: '003', name: 'Alumínio Latinha', price: 6.50 },
  { code: '004', name: 'Alumínio Perfil', price: 8.00 },
  { code: '005', name: 'Ferro Misto', price: 1.20 },
  { code: '006', name: 'Ferro Pesado', price: 1.50 },
  { code: '007', name: 'Bateria', price: 4.00 },
  { code: '008', name: 'Placa Eletrônica', price: 15.00 },
  { code: '009', name: 'Metal / Latão', price: 22.00 }
];

const getInitialValidDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
};

const INITIAL_USERS = [
  {
    id: 'mock_u1',
    cpf: '123',
    name: 'Usuário Padrão',
    email: 'user@scrapsys.com',
    login: '123',
    password: '123',
    role: 'user',
    isActive: true,
    validUntil: getInitialValidDate()
  }
];

const INITIAL_PRINTERS = [
  { id: 'pr_1', name: 'Bematech Térmica 80mm', type: 'receipt', isDefault: true },
  { id: 'pr_2', name: 'Zebra Argox 214', type: 'label', isDefault: true },
  { id: 'pr_3', name: 'Epson EcoTank L3150', type: 'a4', isDefault: true }
];

const loadData = (key, defaultData) => {
  try {
    if (window.electronAPI && window.electronAPI.loadData) {
      const data = window.electronAPI.loadData(key);
      return data ? data : defaultData;
    }
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultData;
  } catch (e) {
    return defaultData;
  }
};

const saveData = (key, data) => {
  try {
    if (window.electronAPI && window.electronAPI.saveData) {
      window.electronAPI.saveData(key, data);
    } else {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (e) {}
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginCpf, setLoginCpf] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [activeTab, setActiveTab] = useState('home');
  const [scraps, setScraps] = useState(() => loadData('scraps', INITIAL_SCRAPS));
  const [transactions, setTransactions] = useState(() => loadData('transactions', []));
  const [initialCash, setInitialCash] = useState(() => loadData('initialCash', 5000)); 
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [tempCash, setTempCash] = useState(initialCash);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [cashAdjustmentValue, setCashAdjustmentValue] = useState('');
  
  const [toast, setToast] = useState({ visible: false, message: '' });

  const showToast = (message) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 3500);
  };
  
  const codeInputRef = useRef(null);

  const [weight, setWeight] = useState('');
  const [code, setCode] = useState('');
  const [selectedScrap, setSelectedScrap] = useState(null);
  const [pricePerKg, setPricePerKg] = useState(0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  
  const [scales, setScales] = useState(() => loadData('scales', [{ id: 'sc_1', name: 'Balança Principal', type: 'bluetooth', isConnected: false }]));
  const [activeScaleId, setActiveScaleId] = useState('sc_1');
  const [scaleLocked, setScaleLocked] = useState(false);

  const [printers, setPrinters] = useState(() => loadData('printers', INITIAL_PRINTERS));
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterType, setNewPrinterType] = useState('receipt');

  const [newScaleType, setNewScaleType] = useState('bluetooth');
  const [newScaleName, setNewScaleName] = useState('');
  const [newScaleIp, setNewScaleIp] = useState('');
  const [isSearchingDevice, setIsSearchingDevice] = useState(false);

  const [isScaleDropdownOpen, setIsScaleDropdownOpen] = useState(false);

  const currentScale = scales.find(s => s.id === activeScaleId);
  const scaleConnected = currentScale?.isConnected || false;

  const [usersList, setUsersList] = useState(() => loadData('global_usersList', INITIAL_USERS));
  const [userSearchTerm, setUserSearchTerm] = useState('');
  
  const [newUserCpf, setNewUserCpf] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  
  const [extendModalUserId, setExtendModalUserId] = useState(null);
  const [extendDaysValue, setExtendDaysValue] = useState(30);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    saveData('global_usersList', usersList);
  }, [usersList]);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      setScraps(loadData(`${currentUser.id}_scraps`, INITIAL_SCRAPS));
      setTransactions(loadData(`${currentUser.id}_transactions`, []));
      setInitialCash(loadData(`${currentUser.id}_initialCash`, 5000));
      setScales(loadData(`${currentUser.id}_scales`, [{ id: 'sc_1', name: 'Balança Principal', type: 'bluetooth', isConnected: false }]));
      setPrinters(loadData(`${currentUser.id}_printers`, INITIAL_PRINTERS));
    } else if (currentUser && currentUser.role === 'admin') {
      setScraps(INITIAL_SCRAPS);
      setTransactions([]);
      setInitialCash(5000);
      setScales([{ id: 'sc_1', name: 'Balança Principal', type: 'bluetooth', isConnected: false }]);
      setPrinters(INITIAL_PRINTERS);
    }
  }, [currentUser]);

  useEffect(() => { if (currentUser && currentUser.role !== 'admin') saveData(`${currentUser.id}_scraps`, scraps); }, [scraps, currentUser]);
  useEffect(() => { if (currentUser && currentUser.role !== 'admin') saveData(`${currentUser.id}_transactions`, transactions); }, [transactions, currentUser]);
  useEffect(() => { if (currentUser && currentUser.role !== 'admin') saveData(`${currentUser.id}_initialCash`, initialCash); }, [initialCash, currentUser]);
  useEffect(() => { if (currentUser && currentUser.role !== 'admin') saveData(`${currentUser.id}_scales`, scales); }, [scales, currentUser]);
  useEffect(() => { if (currentUser && currentUser.role !== 'admin') saveData(`${currentUser.id}_printers`, printers); }, [printers, currentUser]);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable(() => setUpdateAvailable(true));
    }
  }, []);

  const handleApplyUpdate = () => {
    setIsUpdating(true);
    if (window.electronAPI && window.electronAPI.applyUpdate) {
      window.electronAPI.applyUpdate();
    } else {
      setTimeout(() => {
        setIsUpdating(false);
        setUpdateAvailable(false);
        showToast("Simulação: Atualização aplicada e sistema reiniciado.");
      }, 3000);
    }
  };

  const handleAuth = (e) => {
    e.preventDefault();
    if (loginCpf === 'admin' && loginPass === 'admin') {
      setCurrentUser({ id: 'admin', name: 'Administrador Chefe', role: 'admin' });
      setLoginCpf('');
      setLoginPass('');
      setActiveTab('home');
      return;
    }

    const foundUser = usersList.find(u => u.login === loginCpf && u.password === loginPass);
    
    if (foundUser) {
      if (!foundUser.isActive) {
        showToast("Este usuário foi desativado pelo administrador.");
        return;
      }
      if (new Date() > new Date(foundUser.validUntil)) {
        showToast("Licença offline expirada. Contate o administrador.");
        return;
      }
      setCurrentUser(foundUser);
      setLoginCpf('');
      setLoginPass('');
      setActiveTab('home');
    } else {
      showToast("Credenciais incorretas ou não encontradas.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('home');
  };

  const handleSearchHardware = async () => {
    setIsSearchingDevice(true);
    try {
      if (window.electronAPI && window.electronAPI.searchHardware) {
        const deviceName = await window.electronAPI.searchHardware(newScaleType);
        if (deviceName) {
          setNewScaleName(deviceName);
          showToast("Equipamento detectado via integração nativa.");
        } else {
          showToast("Nenhum equipamento encontrado nativamente.");
        }
      } else {
        if (newScaleType === 'bluetooth') {
          if (navigator.bluetooth) {
            const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
            setNewScaleName(device.name || 'Balança Bluetooth');
          } else {
            await new Promise(r => setTimeout(r, 1500));
            setNewScaleName('Balança Toledo BT-X');
            showToast("Aviso: Bluetooth simulado com sucesso.");
          }
        } else if (newScaleType === 'usb') {
          if (navigator.serial) {
            await navigator.serial.requestPort();
            setNewScaleName('Balança USB (COM/Serial)');
          } else {
            await new Promise(r => setTimeout(r, 1500));
            setNewScaleName('Balança Urano (COM4)');
            showToast("Aviso: Ligação USB simulada com sucesso.");
          }
        }
      }
    } catch (error) {
      showToast("A busca foi cancelada ou falhou.");
    } finally {
      setIsSearchingDevice(false);
    }
  };

  const handleAddScale = (e) => {
    e.preventDefault();
    if (!newScaleName) return;
    if (newScaleType === 'rj45' && !newScaleIp) {
      showToast("Introduza o endereço IP da balança.");
      return;
    }
    const newScale = { 
      id: Math.random().toString(36).substr(2, 9), 
      name: newScaleName, type: newScaleType, ip: newScaleType === 'rj45' ? newScaleIp : null, isConnected: false 
    };
    setScales([...scales, newScale]);
    setNewScaleName(''); setNewScaleIp('');
    if (scales.length === 0) setActiveScaleId(newScale.id);
    showToast("Balança adicionada.");
  };

  const toggleScaleConnection = (id) => setScales(scales.map(s => s.id === id ? { ...s, isConnected: !s.isConnected } : s));
  
  const handleDeleteScale = (id) => {
    const filtered = scales.filter(s => s.id !== id);
    setScales(filtered);
    if (activeScaleId === id) setActiveScaleId(filtered.length > 0 ? filtered[0].id : '');
    showToast("Balança removida.");
  };

  const handleAddPrinter = (e) => {
    e.preventDefault();
    if (!newPrinterName) return;
    const isFirstOfType = !printers.some(p => p.type === newPrinterType);
    const newPrinter = {
      id: Math.random().toString(36).substr(2, 9),
      name: newPrinterName,
      type: newPrinterType,
      isDefault: isFirstOfType
    };
    setPrinters([...printers, newPrinter]);
    setNewPrinterName('');
    showToast("Impressora adicionada.");
  };

  const handleSetDefaultPrinter = (id, type) => {
    setPrinters(printers.map(p => {
      if (p.type === type) return { ...p, isDefault: p.id === id };
      return p;
    }));
    showToast("Impressora padrão atualizada.");
  };

  const handleDeletePrinter = (id) => {
    setPrinters(printers.filter(p => p.id !== id));
    showToast("Impressora removida.");
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$&*';
    let pass = '';
    for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    return pass;
  };

  const handleGenerateUser = (e) => {
    e.preventDefault();
    if (!newUserCpf || !newUserName || !newUserEmail) return;

    const loginNumber = newUserCpf.replace(/\D/g, '');
    if (loginNumber.length < 11) {
      showToast("CPF/CNPJ inválido.");
      return;
    }

    const password = generateRandomPassword();
    
    const newUser = {
      id: Math.random().toString(36).substr(2, 9),
      cpf: newUserCpf,
      name: newUserName,
      email: newUserEmail,
      login: loginNumber,
      password: password,
      role: 'user',
      isActive: true,
      validUntil: getInitialValidDate()
    };

    setUsersList([...usersList, newUser]);
    setGeneratedCredentials({ login: loginNumber, password: password, name: newUserName, email: newUserEmail });
    setNewUserCpf('');
    setNewUserName('');
    setNewUserEmail('');
  };

  const copyToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast("Copiado para a área de transferência!");
    } catch (err) {
      showToast("Erro ao copiar.");
    }
    document.body.removeChild(textArea);
  };

  const handleToggleUser = (id) => {
    setUsersList(usersList.map(u => u.id === id ? { ...u, isActive: !u.isActive } : u));
  };

  const handleDeleteUser = (id) => {
    setUsersList(usersList.filter(u => u.id !== id));
    showToast("Usuário removido do sistema.");
  };

  const handleResetUserPassword = (user) => {
    const newPass = generateRandomPassword();
    setUsersList(usersList.map(u => u.id === user.id ? { ...u, password: newPass } : u));
    setGeneratedCredentials({ login: user.login, password: newPass, name: user.name, email: user.email });
    showToast("Senha redefinida com sucesso.");
  };

  const handleExtendValidityConfirm = () => {
    const days = parseInt(extendDaysValue, 10);
    if (isNaN(days) || days <= 0) {
      showToast("Introduza um valor de dias válido.");
      return;
    }
    setUsersList(usersList.map(u => {
      if (u.id === extendModalUserId) {
        const newDate = new Date(u.validUntil);
        newDate.setDate(newDate.getDate() + days);
        return { ...u, validUntil: newDate.toISOString() };
      }
      return u;
    }));
    showToast(`Licença estendida em +${days} dias.`);
    setExtendModalUserId(null);
  };

  const [newScrapName, setNewScrapName] = useState('');
  const [newScrapPrice, setNewScrapPrice] = useState('');
  const [currentItems, setCurrentItems] = useState([]);
  const [isPriceListOpen, setIsPriceListOpen] = useState(false);
  const [isInventoryListOpen, setIsInventoryListOpen] = useState(false);
  const [receiptTx, setReceiptTx] = useState(null);
  const [labelPreview, setLabelPreview] = useState(null);

  useEffect(() => {
    let interval;
    let ticks = 0;
    const baseWeight = Math.floor(Math.random() * 50) + 10;
    const ticksToStabilize = Math.floor(Math.random() * 4) + 3;

    if (scaleConnected && !scaleLocked && activeTab === 'home') {
      interval = setInterval(() => {
        ticks++;
        if (ticks >= ticksToStabilize) {
          setScaleLocked(true);
          setWeight(baseWeight.toFixed(2));
          clearInterval(interval);
        } else {
          const randomFluctuation = (Math.random() * 1.5 - 0.75).toFixed(2);
          setWeight((baseWeight + parseFloat(randomFluctuation)).toFixed(2));
        }
      }, 800);
    }
    return () => clearInterval(interval);
  }, [scaleConnected, scaleLocked, activeTab]);

  useEffect(() => {
    if (code.length >= 3) {
      const found = scraps.find(s => s.code === code || s.code.includes(code));
      if (found) {
        setSelectedScrap(found);
        if (!isCustomPrice) setPricePerKg(found.price);
      } else {
        setSelectedScrap(null);
      }
    } else {
      setSelectedScrap(null);
    }
  }, [code, scraps, isCustomPrice]);

  const totalValue = useMemo(() => (parseFloat(weight) || 0) * pricePerKg, [weight, pricePerKg]);
  const cartTotal = useMemo(() => currentItems.reduce((acc, item) => acc + item.total, 0), [currentItems]);
  const grandTotal = cartTotal + totalValue;

  const stats = useMemo(() => {
    const now = new Date();
    let daily = 0, weekly = 0, monthly = 0, totalSpent = 0, totalWeightKG = 0;
    let inventoryMap = {};

    transactions.forEach(t => {
      if (currentUser?.role === 'user' && t.userId !== currentUser.id) return;

      const tDate = new Date(t.date);
      totalSpent += t.total;

      if (t.items) {
        t.items.forEach(item => {
          totalWeightKG += item.weight;
          if (!inventoryMap[item.code]) inventoryMap[item.code] = { code: item.code, name: item.scrap, weight: 0 };
          inventoryMap[item.code].weight += item.weight;
        });
      }

      if (tDate.toDateString() === now.toDateString()) daily += t.total;
      const diffTime = Math.abs(now - tDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      if (diffDays <= 7) weekly += t.total;
      if (tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()) monthly += t.total;
    });

    return { 
      daily, weekly, monthly, totalSpent, currentCash: initialCash - totalSpent,
      totalWeightTon: (totalWeightKG / 1000).toFixed(3),
      inventoryByCategory: Object.values(inventoryMap).sort((a, b) => b.weight - a.weight)
    };
  }, [transactions, initialCash, currentUser]);

  const handleCashAdjustment = (type) => {
    const val = parseFloat(cashAdjustmentValue);
    if (isNaN(val) || val <= 0) return;
    if (type === 'add') {
      setInitialCash(prev => prev + val);
      showToast(`Suprimento de ${formatCurrency(val)} realizado.`);
    } else if (type === 'remove') {
      setInitialCash(prev => prev - val);
      showToast(`Sangria de ${formatCurrency(val)} realizada.`);
    }
    setCashAdjustmentValue('');
    setIsCashModalOpen(false);
  };

  const handleAddMaterial = () => {
    if (!selectedScrap || !weight || parseFloat(weight) <= 0) return;
    setCurrentItems([...currentItems, {
      id: Math.random().toString(36).substr(2, 9),
      scrap: selectedScrap.name, code: selectedScrap.code,
      weight: parseFloat(weight), pricePerKg, total: totalValue
    }]);
    setWeight(''); setCode(''); setSelectedScrap(null); setIsCustomPrice(false); setScaleLocked(false);
  };

  const handleRemoveItem = (id) => setCurrentItems(currentItems.filter(item => item.id !== id));

  const handleFinalize = () => {
    let finalItems = [...currentItems];
    if (selectedScrap && weight && parseFloat(weight) > 0) {
      finalItems.push({
        id: Math.random().toString(36).substr(2, 9),
        scrap: selectedScrap.name, code: selectedScrap.code,
        weight: parseFloat(weight), pricePerKg, total: totalValue
      });
    }

    if (finalItems.length === 0) return;

    setTransactions([{
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      userName: currentUser.name,
      date: new Date().toISOString(),
      items: finalItems,
      total: finalItems.reduce((acc, item) => acc + item.total, 0)
    }, ...transactions]);
    
    setCurrentItems([]); setWeight(''); setCode(''); setSelectedScrap(null); setIsCustomPrice(false); setScaleLocked(false);
    showToast("Compra finalizada!");
    setTimeout(() => { if (codeInputRef.current) codeInputRef.current.focus(); }, 50);
  };

  const handleRegisterScrap = (e) => {
    e.preventDefault();
    if (!newScrapName || !newScrapPrice) return;
    const maxCode = scraps.reduce((max, s) => Math.max(max, !isNaN(parseInt(s.code, 10)) ? parseInt(s.code, 10) : 0), 0);
    setScraps([...scraps, { code: String(maxCode + 1).padStart(3, '0'), name: newScrapName, price: parseFloat(newScrapPrice) }]);
    setNewScrapName(''); setNewScrapPrice('');
    showToast("Material cadastrado com sucesso.");
  };

  const handleDeleteScrap = (codeToRemove) => {
    setScraps(scraps.filter(s => s.code !== codeToRemove));
    showToast("Material removido.");
  };
  
  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  
  const formatDateTime = (isoString) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
  };

  const formatDateOnly = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR');
  };

  const getScaleIcon = (type, size = 16) => {
    if (type === 'bluetooth') return <Bluetooth size={size} />;
    if (type === 'usb') return <Usb size={size} />;
    if (type === 'rj45') return <Server size={size} />;
    return <MonitorSmartphone size={size} />;
  };

  const getPrinterIcon = (type, size = 16) => {
    if (type === 'label') return <Tag size={size} />;
    if (type === 'a4') return <FileText size={size} />;
    return <Printer size={size} />;
  };

  const getPrinterTypeName = (type) => {
    if (type === 'label') return 'Etiqueta';
    if (type === 'a4') return 'Folha A4';
    return 'Cupom';
  };

  const handlePreviewLabel = (scrap) => {
    const defaultPrinter = printers.find(p => p.type === 'label' && p.isDefault);
    if (!defaultPrinter) {
      showToast("Configure uma impressora de Etiqueta padrão primeiro.");
      return;
    }
    setLabelPreview(scrap);
  };

  const confirmPrintLabel = () => {
    const defaultPrinter = printers.find(p => p.type === 'label' && p.isDefault);
    if (window.electronAPI && window.electronAPI.printLabel) {
      window.electronAPI.printLabel(labelPreview, defaultPrinter);
    }
    showToast(`Impressão enviada para: ${defaultPrinter.name}`);
    setLabelPreview(null);
  };

  const printReceipt = () => {
    const defaultPrinter = printers.find(p => p.type === 'receipt' && p.isDefault);
    if (!defaultPrinter) {
      showToast("Configure uma impressora de Cupom padrão primeiro.");
      return;
    }
    if (window.electronAPI && window.electronAPI.printReceipt) {
      window.electronAPI.printReceipt(receiptTx, defaultPrinter);
    }
    showToast(`Cupom enviado para: ${defaultPrinter.name}`);
    setReceiptTx(null);
  };

  const filteredUsers = usersList.filter(u => 
    u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
    u.login.includes(userSearchTerm) || 
    u.cpf.includes(userSearchTerm)
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-zinc-800/40 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative z-10 animate-in zoom-in-95">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-emerald-500/20 p-4 rounded-2xl border border-emerald-500/30 mb-4">
              <Scale className="text-emerald-400" size={40} />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white/90">ScrapSys</h1>
            <p className="text-sm text-gray-500 tracking-widest uppercase mt-1">Industrial Offline System</p>
          </div>

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wider">Login</label>
              <input type="text" value={loginCpf} onChange={e => setLoginCpf(e.target.value)} placeholder="Seu CPF/CNPJ" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-gray-200 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all text-sm" required autoFocus/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wider">Senha</label>
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="••••••••" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-gray-200 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all text-sm" required/>
            </div>
            <button type="submit" className="w-full mt-4 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/50 transition-all border border-emerald-500/50">Acessar Sistema</button>
          </form>
        </div>

        {toast.visible && (
          <div className="fixed bottom-6 right-6 z-[100] bg-zinc-800 text-white px-6 py-4 rounded-xl shadow-2xl border border-white/10 animate-in slide-in-from-bottom-5 fade-in flex items-center gap-3 font-medium text-sm">
            <CheckCircle size={18} className="text-emerald-500" />
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 font-sans p-4 md:p-8 selection:bg-emerald-500/30 flex flex-col relative overflow-hidden">
      
      {updateAvailable && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] bg-indigo-600 text-white px-6 py-3 rounded-full shadow-2xl border border-indigo-400/30 animate-in slide-in-from-top-5 fade-in flex items-center gap-4 font-bold text-sm">
          <div className="flex items-center gap-2">
            <Download size={18} className="animate-bounce" />
            Nova versão disponível
          </div>
          <button onClick={handleApplyUpdate} disabled={isUpdating} className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full transition-colors flex items-center gap-2 disabled:opacity-50">
            {isUpdating ? <RefreshCw size={14} className="animate-spin" /> : 'Atualizar Agora'}
          </button>
          <button onClick={() => setUpdateAvailable(false)} className="text-indigo-200 hover:text-white transition-colors ml-2"><X size={16} /></button>
        </div>
      )}

      {toast.visible && (
        <div className="fixed bottom-6 right-6 z-[100] bg-zinc-800 text-white px-6 py-4 rounded-xl shadow-2xl border border-white/10 animate-in slide-in-from-bottom-5 fade-in flex items-center gap-3 font-medium text-sm">
          <CheckCircle size={18} className="text-emerald-500" />
          {toast.message}
        </div>
      )}

      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-zinc-800/40 rounded-full blur-[120px] pointer-events-none"></div>

      <header className="flex justify-between items-center mb-8 max-w-6xl mx-auto w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl z-10">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/20 p-2 rounded-xl backdrop-blur-md border border-emerald-500/30">
            <Scale className="text-emerald-400" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white/90">ScrapSys</h1>
            <p className="text-[10px] text-emerald-500/70 font-mono tracking-widest">{currentUser.name}</p>
          </div>
        </div>

        <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 gap-1">
          <button onClick={() => setActiveTab('home')} title="Pesagem Rápida" className={`p-3 rounded-lg transition-all ${activeTab === 'home' ? 'bg-zinc-800 text-emerald-400 shadow-md border border-white/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}><Home size={22} /></button>
          <button onClick={() => setActiveTab('finance')} title="Financeiro" className={`p-3 rounded-lg transition-all ${activeTab === 'finance' ? 'bg-zinc-800 text-emerald-400 shadow-md border border-white/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}><PieChart size={22} /></button>
          <button onClick={() => setActiveTab('register')} title="Cadastro de Material" className={`p-3 rounded-lg transition-all ${activeTab === 'register' ? 'bg-zinc-800 text-emerald-400 shadow-md border border-white/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}><PackagePlus size={22} /></button>
          <button onClick={() => setActiveTab('settings')} title="Configurações" className={`p-3 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-zinc-800 text-emerald-400 shadow-md border border-white/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}><Settings size={22} /></button>
          
          {currentUser.role === 'admin' && (
            <>
              <div className="w-px h-8 bg-white/10 my-auto mx-1"></div>
              <button onClick={() => setActiveTab('users')} title="Painel Admin" className={`p-3 rounded-lg transition-all ${activeTab === 'users' ? 'bg-zinc-800 text-indigo-400 shadow-md border border-white/10' : 'text-indigo-500/50 hover:text-indigo-400 hover:bg-white/5'}`}><Shield size={22} /></button>
            </>
          )}
          
          <div className="w-px h-8 bg-white/10 my-auto mx-1"></div>
          <button onClick={handleLogout} title="Sair do Sistema" className="p-3 rounded-lg transition-all text-red-500/50 hover:text-red-400 hover:bg-white/5"><LogOut size={22} /></button>
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col items-center z-10 pb-10">
        
        {activeTab === 'home' && (
          <div className="w-full flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`flex flex-col lg:flex-row gap-6 items-start transition-all duration-500 w-full ${isPriceListOpen ? 'max-w-5xl' : 'max-w-3xl'}`}>
              
              <div className="flex-1 w-full flex flex-col gap-6">
                <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden transition-all">
                  
                  <div className="mb-8 bg-black/50 rounded-3xl p-6 border border-white/5 relative text-center shadow-inner">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
                      
                      <div className="relative w-full sm:w-auto">
                        <div 
                          onClick={() => setIsScaleDropdownOpen(!isScaleDropdownOpen)}
                          className="flex items-center gap-3 w-full bg-zinc-900/80 px-4 py-2.5 rounded-xl border border-white/10 cursor-pointer hover:bg-zinc-800 transition-colors shadow-sm"
                        >
                          <span className="text-emerald-500/70">
                            {currentScale ? getScaleIcon(currentScale.type, 18) : <Scale size={18} />}
                          </span>
                          <div className="flex-1 sm:w-48 text-left text-gray-200 text-sm font-medium truncate">
                            {scales.length === 0 ? 'Sem balanças' : (currentScale ? currentScale.name : 'Selecione...')}
                            {currentScale?.isConnected && <span className="ml-2 text-emerald-500">✓</span>}
                          </div>
                          <ChevronDown size={14} className={`text-gray-500 transition-transform ${isScaleDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>

                        {isScaleDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsScaleDropdownOpen(false)}></div>
                            <div className="absolute top-full left-0 mt-2 w-full min-w-[240px] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                              {scales.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-gray-500">Nenhuma balança configurada</div>
                              ) : (
                                scales.map(s => (
                                  <div 
                                    key={s.id}
                                    onClick={() => { setActiveScaleId(s.id); setScaleLocked(false); setWeight(''); setIsScaleDropdownOpen(false); }}
                                    className={`px-4 py-3 text-sm font-medium transition-colors cursor-pointer flex justify-between items-center ${activeScaleId === s.id ? 'bg-zinc-800 text-emerald-400' : 'text-gray-300 hover:bg-zinc-800/50'}`}
                                  >
                                    <div className="flex items-center gap-2 truncate pr-2">
                                      <span className="opacity-50">{getScaleIcon(s.type, 14)}</span>
                                      <span className="truncate">{s.name}</span>
                                    </div>
                                    {s.isConnected && <span className="text-emerald-500 font-bold shrink-0">✓</span>}
                                  </div>
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex w-full sm:w-auto justify-between sm:justify-end items-center gap-3">
                        <button onClick={() => setIsPriceListOpen(!isPriceListOpen)} className={`text-xs px-4 py-2 rounded-xl flex items-center gap-2 transition-colors font-medium border ${isPriceListOpen ? 'bg-zinc-800 text-gray-200 border-white/20' : 'bg-zinc-900/80 text-gray-400 border-white/10 hover:bg-zinc-800'}`}>
                          <span className="hidden sm:inline">Tabela</span>
                          {isPriceListOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-12 sm:mt-8 flex justify-center items-baseline gap-2">
                      <input 
                        type="number" value={weight} onChange={(e) => { setWeight(e.target.value); setScaleLocked(true); }}
                        placeholder="0.00" className="w-full text-center bg-transparent text-6xl sm:text-8xl font-black text-white outline-none placeholder-gray-800" disabled={!activeScaleId}
                      />
                      <span className="text-2xl sm:text-4xl font-bold text-gray-600">KG</span>
                    </div>
                    
                    <div className="mt-6 flex gap-2 justify-center">
                      {scaleConnected && !scaleLocked && (
                        <button onClick={() => setScaleLocked(true)} className="px-6 py-2 bg-zinc-800 text-gray-300 rounded-xl border border-white/10 hover:bg-zinc-700 transition-all font-medium text-sm">Travar Peso</button>
                      )}
                      {scaleConnected && scaleLocked && (
                        <button onClick={() => setScaleLocked(false)} className="px-6 py-2 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 hover:bg-amber-500/20 transition-all font-medium text-sm">Ler Novamente</button>
                      )}
                      {scaleConnected && scaleLocked && (
                        <span className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 text-sm font-medium flex items-center gap-2"><CheckCircle size={14} /> Estabilizado</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                      <label className="text-xs text-gray-500 mb-2 flex items-center gap-1.5 uppercase tracking-wider font-semibold"><Barcode size={14} /> Código / Leitor</label>
                      <input 
                        ref={codeInputRef} type="text" value={code} onChange={(e) => setCode(e.target.value)}
                        placeholder="Digite ou bipe..." className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-xl font-medium text-white placeholder-gray-700 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all" autoFocus
                      />
                    </div>
                    <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex flex-col justify-center">
                      <label className="text-xs text-gray-500 mb-1 flex items-center gap-1.5 uppercase tracking-wider font-semibold"><Search size={14} /> Material Identificado</label>
                      <div className="text-2xl font-bold text-white truncate mt-1">{selectedScrap ? selectedScrap.name : <span className="text-gray-700">A aguardar...</span>}</div>
                    </div>
                  </div>

                  <div className="bg-zinc-900/80 rounded-3xl p-6 border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6 mb-8 shadow-md">
                    <div className="w-full sm:w-auto">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Valor Base</span>
                        <button onClick={() => setIsCustomPrice(!isCustomPrice)} className="text-xs bg-white/5 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"><Edit3 size={14} /></button>
                      </div>
                      {isCustomPrice ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xl text-gray-500">R$</span>
                          <input type="number" value={pricePerKg} onChange={(e) => setPricePerKg(parseFloat(e.target.value) || 0)} className="w-32 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-2xl font-bold text-white outline-none focus:border-emerald-500/50"/>
                        </div>
                      ) : (
                        <div className="text-3xl font-bold text-white">{formatCurrency(pricePerKg)}<span className="text-lg text-gray-600 font-normal">/kg</span></div>
                      )}
                    </div>
                    <div className="hidden sm:block w-px h-16 bg-white/5"></div>
                    <div className="w-full sm:w-auto text-left sm:text-right bg-black/20 sm:bg-transparent p-4 sm:p-0 rounded-2xl border border-white/5 sm:border-none">
                      <span className="text-xs text-emerald-500/80 font-medium uppercase tracking-wider block mb-1">Total deste Item</span>
                      <div className="text-5xl font-black text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.15)]">{formatCurrency(totalValue)}</div>
                    </div>
                  </div>

                  {currentItems.length > 0 && (
                    <div className="mb-6 bg-black/30 rounded-2xl p-4 border border-white/5">
                      <h4 className="text-[10px] uppercase text-gray-500 mb-3 tracking-widest font-bold">Materiais na Compra Atual</h4>
                      <div className="space-y-2 mb-3">
                        {currentItems.map(item => (
                          <div key={item.id} className="flex justify-between items-center text-sm bg-white/5 px-4 py-2.5 rounded-xl group transition-all hover:bg-white/10">
                            <span className="text-gray-300 font-medium"><span className="font-mono text-gray-600 text-xs mr-3">#{item.code}</span>{item.scrap} <span className="text-gray-500 ml-1 font-normal">({item.weight}kg)</span></span>
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-gray-200">{formatCurrency(item.total)}</span>
                              <button onClick={() => handleRemoveItem(item.id)} className="text-red-500/50 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-white/5 px-1">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Subtotal Materiais</span>
                        <span className="font-bold text-emerald-500">{formatCurrency(cartTotal)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={handleAddMaterial} disabled={!selectedScrap || totalValue <= 0} className="flex-1 h-16 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900/50 disabled:text-gray-700 disabled:border-transparent text-white rounded-2xl font-bold text-lg transition-all flex justify-center items-center gap-2 border border-white/10"><Plus size={20} /> Add à Lista</button>
                    <button onClick={handleFinalize} disabled={(!selectedScrap || totalValue <= 0) && currentItems.length === 0} className="flex-[2] h-16 sm:h-auto bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-900/50 disabled:text-gray-700 disabled:border-transparent text-white rounded-2xl font-black text-xl sm:text-2xl shadow-[0_0_20px_rgba(5,150,105,0.2)] disabled:shadow-none transition-all flex justify-center items-center gap-3 border border-emerald-500/50"><CheckCircle size={24} /> FINALIZAR ({formatCurrency(grandTotal)})</button>
                  </div>
                </div>
              </div>

              {isPriceListOpen && (
                <div className="w-full lg:w-[320px] shrink-0 bg-[#121212]/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-right-4 fade-in">
                  <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-white/5 pb-4"><Tag className="text-gray-500" size={16} /> Tabela de Preços</h3>
                  <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                    {scraps.map(s => (
                      <div key={s.code} className="flex justify-between items-center p-3 bg-black/40 border border-white/5 rounded-xl hover:bg-white/5">
                        <div><p className="font-bold text-gray-200 text-sm">{s.name}</p><p className="text-xs text-gray-600 font-mono">#{s.code}</p></div>
                        <span className="text-emerald-500 font-bold text-sm">{formatCurrency(s.price)}<span className="text-gray-600 font-normal text-xs ml-0.5">/kg</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="w-full flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`flex flex-col lg:flex-row gap-6 items-start transition-all duration-500 w-full ${isInventoryListOpen ? 'max-w-[85rem]' : 'max-w-6xl'}`}>
              <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="flex flex-col gap-4">
                  <div className="bg-emerald-950/20 backdrop-blur-xl border border-emerald-900/30 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-4 right-4 z-10">
                      <button onClick={() => setIsCashModalOpen(true)} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/20" title="Ajustar Caixa">
                        <Edit3 size={16} />
                      </button>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-10"><Wallet size={120} className="text-emerald-500" /></div>
                    <p className="text-emerald-500/70 font-semibold uppercase tracking-widest mb-2 text-[10px]">Caixa Atual Disponível</p>
                    <p className="text-4xl font-black text-emerald-400">{formatCurrency(stats.currentCash)}</p>
                  </div>
                  <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 relative overflow-hidden shadow-md">
                    <p className="text-gray-500 font-semibold uppercase tracking-widest mb-2 text-[10px]">Total Comprado Hoje</p>
                    <p className="text-3xl font-bold text-gray-200">{formatCurrency(stats.daily)}</p>
                  </div>
                  <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 relative overflow-hidden shadow-md">
                    <p className="text-gray-500 font-semibold uppercase tracking-widest mb-2 text-[10px]">Comprado Esta Semana</p>
                    <p className="text-3xl font-bold text-gray-200">{formatCurrency(stats.weekly)}</p>
                  </div>
                  <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-gray-400 font-semibold uppercase tracking-widest text-[10px]">Inventário Comprado</p>
                      <button onClick={() => setIsInventoryListOpen(!isInventoryListOpen)} className={`text-xs p-1.5 rounded-lg border relative z-10 ${isInventoryListOpen ? 'bg-zinc-700 text-gray-200 border-transparent' : 'bg-white/5 text-gray-500 hover:bg-white/10 border-white/10'}`}>
                        {isInventoryListOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </div>
                    <p className="text-3xl font-bold text-gray-200">{stats.totalWeightTon} <span className="text-xl text-gray-600 font-medium">Ton</span></p>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 flex flex-col h-[600px] shadow-xl">
                  <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
                    <h2 className="text-sm font-bold flex items-center gap-2 text-gray-300 uppercase tracking-widest"><History className="text-gray-500" size={16} /> Histórico de Compras</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {transactions.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center mt-10">Nenhuma transação registada.</p>
                    ) : (
                      <div className="space-y-3">
                        {transactions.map((tx) => {
                          const txTitle = tx.items.length === 1 ? tx.items[0].scrap : `${tx.items.length} Materiais Diversos`;
                          return (
                          <div key={tx.id} className="bg-black/40 hover:bg-zinc-800/80 border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                            <div><p className="font-bold text-sm text-gray-200">{txTitle} <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-gray-500 ml-2 border border-white/5">{tx.userName}</span></p><p className="text-xs text-gray-500 mt-1">{formatDateTime(tx.date)}</p></div>
                            <div className="flex items-center gap-4">
                              <span className="text-lg font-black text-red-400/90">- {formatCurrency(tx.total)}</span>
                              <button onClick={() => setReceiptTx(tx)} className="p-2 bg-white/5 rounded-lg text-gray-500 hover:text-gray-200"><Printer size={16} /></button>
                            </div>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isInventoryListOpen && (
                <div className="w-full lg:w-[320px] shrink-0 bg-[#121212]/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-right-4 fade-in flex flex-col h-full lg:h-[600px]">
                  <h3 className="text-sm font-bold text-gray-300 mb-6 flex items-center gap-2 border-b border-white/5 pb-4 uppercase tracking-widest"><PackagePlus className="text-gray-500" size={16} /> Detalhes</h3>
                  <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2 flex-1">
                    {stats.inventoryByCategory.map(inv => (
                      <div key={inv.code} className="flex justify-between items-center p-3 bg-black/40 border border-white/5 rounded-xl">
                        <div><p className="font-bold text-gray-300 text-sm">{inv.name}</p></div>
                        <span className="text-emerald-500/80 font-bold text-sm">{inv.weight >= 1000 ? (inv.weight / 1000).toFixed(2) + ' Ton' : inv.weight.toFixed(2) + ' kg'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'register' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl w-full">
            <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 shadow-xl h-fit">
              <h2 className="text-sm font-bold mb-6 flex items-center gap-2 text-gray-300 uppercase tracking-widest border-b border-white/5 pb-4"><Plus size={16} className="text-emerald-500" /> Nova Sucata</h2>
              <form onSubmit={handleRegisterScrap} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-2 block">DESCRIÇÃO DO MATERIAL</label>
                  <input type="text" value={newScrapName} onChange={(e) => setNewScrapName(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-gray-200 outline-none text-sm" required/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-2 block">VALOR BASE (R$/KG)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-[14px] text-gray-600 text-sm">R$</span>
                    <input type="number" step="0.01" value={newScrapPrice} onChange={(e) => setNewScrapPrice(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-gray-200 outline-none text-sm" required/>
                  </div>
                </div>
                <button type="submit" className="w-full mt-2 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-gray-200 rounded-xl font-bold text-sm shadow-lg transition-all border border-white/10">Salvar Cadastro</button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 flex flex-col h-[600px] shadow-xl">
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                <h2 className="text-sm font-bold flex items-center gap-2 text-gray-300 uppercase tracking-widest"><Tag className="text-emerald-500" size={16} /> Tabela de Preços e Códigos</h2>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {scraps.map((s) => (
                    <div key={s.code} className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:bg-zinc-900/80">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center justify-center bg-white/5 p-2 rounded-xl border border-white/5">
                          <Barcode size={20} className="text-gray-500 mb-1" />
                          <span className="text-[10px] font-mono font-bold text-gray-400">{s.code}</span>
                        </div>
                        <div>
                          <p className="font-bold text-gray-200 text-sm">{s.name}</p>
                          <p className="text-xs font-semibold text-emerald-500/80 mt-0.5">{formatCurrency(s.price)}/kg</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => handlePreviewLabel(s)} className="p-2 text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all border border-transparent hover:border-emerald-400/20" title="Imprimir Etiqueta"><Printer size={16} /></button>
                        <button onClick={() => handleDeleteScrap(s.code)} className="p-2 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all border border-transparent hover:border-red-500/20" title="Remover"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex flex-col max-w-5xl mx-auto w-full gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-900 rounded-full mix-blend-multiply filter blur-[100px] opacity-10"></div>
              <h2 className="text-sm font-bold mb-8 flex items-center gap-2 text-gray-300 uppercase tracking-widest border-b border-white/5 pb-4"><Scale size={16} className="text-gray-500" /> Gestão de Balanças</h2>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 relative z-10">
                <div className="md:col-span-5 bg-black/30 rounded-2xl p-5 border border-white/5">
                  <h3 className="text-xs font-semibold text-gray-500 mb-5 block uppercase tracking-wider">Adicionar Dispositivo</h3>
                  <form onSubmit={handleAddScale} className="flex flex-col gap-5">
                    <div>
                      <label className="text-[10px] font-bold text-gray-600 mb-2 block uppercase tracking-widest">Tipo de Ligação</label>
                      <div className="grid grid-cols-3 gap-2">
                        <div onClick={() => {setNewScaleType('bluetooth'); setNewScaleName('');}} className={`cursor-pointer flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${newScaleType === 'bluetooth' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-black/50 border-white/5 text-gray-500 hover:bg-white/5'}`}><Bluetooth size={20} className="mb-1" /><span className="text-[10px] font-bold">Bluetooth</span></div>
                        <div onClick={() => {setNewScaleType('usb'); setNewScaleName('');}} className={`cursor-pointer flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${newScaleType === 'usb' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-black/50 border-white/5 text-gray-500 hover:bg-white/5'}`}><Usb size={20} className="mb-1" /><span className="text-[10px] font-bold">USB/Serial</span></div>
                        <div onClick={() => {setNewScaleType('rj45'); setNewScaleName('');}} className={`cursor-pointer flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${newScaleType === 'rj45' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-black/50 border-white/5 text-gray-500 hover:bg-white/5'}`}><Wifi size={20} className="mb-1" /><span className="text-[10px] font-bold">Rede IP</span></div>
                      </div>
                    </div>
                    {(newScaleType === 'bluetooth' || newScaleType === 'usb') && (
                      <div className="bg-zinc-900/80 p-4 rounded-xl border border-white/5">
                        <button type="button" onClick={handleSearchHardware} disabled={isSearchingDevice} className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 rounded-lg font-medium text-xs transition-all flex justify-center items-center gap-2 border border-white/10">
                          {isSearchingDevice ? <span className="animate-pulse">A procurar...</span> : <><Search size={14} /> Buscar Dispositivo</>}
                        </button>
                      </div>
                    )}
                    {newScaleType === 'rj45' && (
                      <div><label className="text-[10px] font-bold text-gray-600 mb-2 block uppercase tracking-widest">Endereço IP</label><input type="text" value={newScaleIp} onChange={(e) => setNewScaleIp(e.target.value)} placeholder="Ex: 192.168.0.50" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-gray-200 placeholder-gray-700 outline-none text-sm font-mono"/></div>
                    )}
                    <div><label className="text-[10px] font-bold text-gray-600 mb-2 block uppercase tracking-widest">Identificação (Nome)</label><input type="text" value={newScaleName} onChange={(e) => setNewScaleName(e.target.value)} placeholder="Nome da Balança" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-gray-200 placeholder-gray-700 outline-none transition-all text-sm" required/></div>
                    <button type="submit" disabled={!newScaleName} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-gray-200 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 border border-white/10 mt-2"><Plus size={16} /> Salvar Configuração</button>
                  </form>
                </div>
                <div className="md:col-span-7">
                  <div className="bg-black/30 rounded-2xl p-5 border border-white/5 flex flex-col min-h-full">
                    <h3 className="text-[10px] uppercase text-gray-500 mb-5 tracking-widest font-bold">Equipamentos Registados ({scales.length})</h3>
                    {scales.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-600"><Scale size={40} className="opacity-30 mb-3" /><p className="text-sm">Nenhuma balança.</p></div>
                    ) : (
                      <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[500px]">
                        {scales.map(s => (
                          <div key={s.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/5 p-4 rounded-xl border border-white/5 gap-4 hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-xl border shadow-inner ${s.isConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-black/50 text-gray-500 border-white/5'}`}>{getScaleIcon(s.type, 20)}</div>
                              <div>
                                <p className="font-bold text-gray-200 text-sm flex items-center gap-2">{s.name}<span className="text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-gray-500 uppercase font-bold border border-white/5">{s.type}</span></p>
                                <p className="text-[10px] text-gray-500 font-mono mt-1">ID: {s.id} {s.ip && `• IP: ${s.ip}`}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button onClick={() => toggleScaleConnection(s.id)} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all border ${s.isConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-black/50 text-gray-400 border-white/10 hover:bg-zinc-800'}`}>{s.isConnected ? 'Desconectar' : 'Testar Conexão'}</button>
                              <button onClick={() => handleDeleteScale(s.id)} className="p-2 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-900 rounded-full mix-blend-multiply filter blur-[100px] opacity-10"></div>
              <h2 className="text-sm font-bold mb-8 flex items-center gap-2 text-gray-300 uppercase tracking-widest border-b border-white/5 pb-4"><Printer size={16} className="text-gray-500" /> Gestão de Impressoras</h2>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 relative z-10">
                <div className="md:col-span-5 bg-black/30 rounded-2xl p-5 border border-white/5">
                  <h3 className="text-xs font-semibold text-gray-500 mb-5 block uppercase tracking-wider">Adicionar Impressora</h3>
                  <form onSubmit={handleAddPrinter} className="flex flex-col gap-5">
                    <div>
                      <label className="text-[10px] font-bold text-gray-600 mb-2 block uppercase tracking-widest">Tipo de Impressora</label>
                      <div className="grid grid-cols-3 gap-2">
                        <div onClick={() => setNewPrinterType('label')} className={`cursor-pointer flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${newPrinterType === 'label' ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400' : 'bg-black/50 border-white/5 text-gray-500 hover:bg-white/5'}`}><Tag size={20} className="mb-1" /><span className="text-[10px] font-bold">Etiqueta</span></div>
                        <div onClick={() => setNewPrinterType('receipt')} className={`cursor-pointer flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${newPrinterType === 'receipt' ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400' : 'bg-black/50 border-white/5 text-gray-500 hover:bg-white/5'}`}><Printer size={20} className="mb-1" /><span className="text-[10px] font-bold">Cupom</span></div>
                        <div onClick={() => setNewPrinterType('a4')} className={`cursor-pointer flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${newPrinterType === 'a4' ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400' : 'bg-black/50 border-white/5 text-gray-500 hover:bg-white/5'}`}><FileText size={20} className="mb-1" /><span className="text-[10px] font-bold">Folha A4</span></div>
                      </div>
                    </div>
                    <div><label className="text-[10px] font-bold text-gray-600 mb-2 block uppercase tracking-widest">Identificação (Nome da Fila/Rede)</label><input type="text" value={newPrinterName} onChange={(e) => setNewPrinterName(e.target.value)} placeholder="Ex: Zebra_Etiquetas_USB" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-gray-200 placeholder-gray-700 outline-none transition-all text-sm" required/></div>
                    <button type="submit" disabled={!newPrinterName} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-gray-200 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 border border-white/10 mt-2"><Plus size={16} /> Salvar Impressora</button>
                  </form>
                </div>
                <div className="md:col-span-7">
                  <div className="bg-black/30 rounded-2xl p-5 border border-white/5 flex flex-col min-h-full">
                    <h3 className="text-[10px] uppercase text-gray-500 mb-5 tracking-widest font-bold">Impressoras Registadas ({printers.length})</h3>
                    {printers.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-600"><Printer size={40} className="opacity-30 mb-3" /><p className="text-sm">Nenhuma impressora.</p></div>
                    ) : (
                      <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[350px]">
                        {printers.map(p => (
                          <div key={p.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/5 p-4 rounded-xl border transition-colors ${p.isDefault ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-white/5 hover:bg-white/10'}`}>
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-xl border shadow-inner ${p.isDefault ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-black/50 text-gray-500 border-white/5'}`}>{getPrinterIcon(p.type, 20)}</div>
                              <div>
                                <p className="font-bold text-gray-200 text-sm flex items-center gap-2">
                                  {p.name}
                                  {p.isDefault && <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 uppercase font-bold border border-indigo-500/20">Padrão</span>}
                                </p>
                                <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">{getPrinterTypeName(p.type)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                              {!p.isDefault && (
                                <button onClick={() => handleSetDefaultPrinter(p.id, p.type)} className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-black/50 text-gray-400 border border-white/10 hover:bg-zinc-800 hover:text-white">Definir Padrão</button>
                              )}
                              <button onClick={() => handleDeletePrinter(p.id)} className="p-2 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        )}

        {activeTab === 'users' && currentUser.role === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl w-full">
            <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 shadow-xl h-fit relative overflow-hidden">
              <div className="absolute -top-32 -left-32 w-64 h-64 bg-indigo-900 rounded-full mix-blend-multiply filter blur-[100px] opacity-10"></div>
              
              <h2 className="text-sm font-bold mb-6 flex items-center gap-2 text-gray-300 uppercase tracking-widest border-b border-white/5 pb-4">
                <UserPlus size={16} className="text-indigo-400" /> Criar Licença
              </h2>
              
              <form onSubmit={handleGenerateUser} className="flex flex-col gap-5 relative z-10">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wider">CPF ou CNPJ</label>
                  <input type="text" value={newUserCpf} onChange={(e) => setNewUserCpf(e.target.value)} placeholder="000.000.000-00" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-700 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all text-sm" required/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wider">Nome / Razão Social</label>
                  <input type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="João da Silva" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-700 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all text-sm" required/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wider">E-mail</label>
                  <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="joao@email.com" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-700 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all text-sm" required/>
                </div>
                <button type="submit" className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg transition-all flex justify-center items-center gap-2 border border-indigo-500/50">Gerar Acesso (+30 Dias)</button>
              </form>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {generatedCredentials && (
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-[2rem] p-6 shadow-xl animate-in zoom-in-95 relative">
                  <button onClick={() => setGeneratedCredentials(null)} className="absolute top-4 right-4 text-indigo-400/50 hover:text-indigo-400 transition-colors p-1"><X size={18} /></button>
                  <h3 className="text-sm font-bold text-indigo-300 mb-4 uppercase tracking-widest flex items-center gap-2"><Key size={16} /> Credenciais Geradas</h3>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Login (CPF/CNPJ)</p>
                      <p className="text-lg font-mono font-bold text-gray-200">{generatedCredentials.login}</p>
                    </div>
                    <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Senha Gerada</p>
                      <p className="text-lg font-mono font-bold text-emerald-400">{generatedCredentials.password}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => copyToClipboard(`Acesso ScrapSys\nLogin: ${generatedCredentials.login}\nSenha: ${generatedCredentials.password}\n\nPainel isolado exclusivo.`)} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 border border-white/10"><Copy size={16} /> Copiar para Área de Transferência</button>
                    <a href={`mailto:${generatedCredentials.email}?subject=Seu Acesso ScrapSys&body=Olá ${generatedCredentials.name},%0D%0A%0D%0ASeu acesso ao painel do ferro-velho foi gerado.%0D%0ALogin: ${generatedCredentials.login}%0D%0ASenha: ${generatedCredentials.password}%0D%0A%0D%0AAcesso exclusivo ao seu painel.`} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 border border-indigo-500/50"><Mail size={16} /> Enviar por E-mail</a>
                  </div>
                </div>
              )}

              <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 flex flex-col flex-1 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-gray-300 uppercase tracking-widest"><Users className="text-indigo-400" size={16} /> Clientes / Licenças</h2>
                  <div className="flex items-center gap-4">
                    <div className="relative w-full sm:w-64">
                      <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                      <input type="text" value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} placeholder="Procurar usuário..." className="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-white outline-none focus:border-indigo-500/50 text-xs transition-all" />
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 shrink-0">{filteredUsers.length} ativas</div>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[400px]">
                  {filteredUsers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600">
                      <Shield size={40} className="opacity-30 mb-3" />
                      <p className="text-sm">Nenhuma licença encontrada.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {filteredUsers.map((u) => (
                        <div key={u.id} className={`bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between transition-all ${!u.isActive ? 'opacity-50' : ''}`}>
                          <div className="flex items-center gap-4 mb-4 xl:mb-0">
                            <div className={`flex items-center justify-center p-3 rounded-xl border ${u.isActive ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-black/50 border-white/5 text-gray-600'}`}>
                              <Users size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-gray-200 text-sm flex items-center gap-2">
                                {u.name}
                                {new Date() > new Date(u.validUntil) && <span className="bg-red-500/20 text-red-400 text-[9px] px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-widest">Expirado</span>}
                              </p>
                              <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-2">
                                Login: <span className="font-mono bg-white/5 px-1 rounded">{u.login}</span> 
                                <span className="opacity-50">•</span> 
                                Válido até: <span className={`${new Date() > new Date(u.validUntil) ? 'text-red-400' : 'text-emerald-400 font-bold'}`}>{formatDateOnly(u.validUntil)}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full xl:w-auto">
                            <button onClick={() => handleToggleUser(u.id)} className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors border ${u.isActive ? 'bg-emerald-500/50 border-emerald-500/50' : 'bg-black/50 border-white/10'}`} title={u.isActive ? 'Bloquear Acesso' : 'Liberar Acesso'}><span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${u.isActive ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                            <button onClick={() => { setExtendDaysValue(30); setExtendModalUserId(u.id); }} className="px-3 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-bold hover:bg-indigo-500/20 transition-all flex items-center gap-1" title="Estender Token Local"><CalendarClock size={14}/> Renovar</button>
                            <button onClick={() => handleResetUserPassword(u)} className="px-3 py-2 bg-black/50 text-gray-400 border border-white/10 rounded-lg text-xs font-bold hover:bg-zinc-800 hover:text-white transition-all"><Key size={14}/></button>
                            <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all border border-transparent hover:border-red-500/20"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {extendModalUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#121212] border border-white/10 text-gray-200 w-full max-w-[320px] rounded-3xl shadow-2xl flex flex-col relative overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2 text-sm"><CalendarClock size={16}/> Renovar Licença</h3>
              <button onClick={() => setExtendModalUserId(null)} className="text-gray-500 hover:text-gray-300 transition-colors"><X size={18}/></button>
            </div>
            <p className="text-[10px] uppercase text-gray-500 mb-5 tracking-widest font-semibold">Quantidade de dias a estender para este cliente.</p>
            
            <div className="relative mb-6">
               <input type="number" value={extendDaysValue} onChange={(e) => setExtendDaysValue(e.target.value)} placeholder="Dias..." className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 text-center text-lg font-bold" autoFocus />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setExtendModalUserId(null)} className="flex-1 py-3 bg-white/5 text-gray-400 border border-white/10 rounded-xl font-bold text-xs hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={handleExtendValidityConfirm} disabled={!extendDaysValue || parseInt(extendDaysValue) <= 0} className="flex-[2] py-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl font-bold text-xs hover:bg-indigo-500/20 disabled:opacity-50 transition-colors flex justify-center items-center gap-1.5"><CheckCircle size={14}/> Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {isCashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#121212] border border-white/10 text-gray-200 w-full max-w-[320px] rounded-3xl shadow-2xl flex flex-col relative overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2 text-sm"><Wallet size={16}/> Ajuste de Caixa</h3>
              <button onClick={() => setIsCashModalOpen(false)} className="text-gray-500 hover:text-gray-300 transition-colors"><X size={18}/></button>
            </div>
            <p className="text-[10px] uppercase text-gray-500 mb-5 tracking-widest font-semibold">Adicione ou remova valores do seu caixa atual.</p>
            
            <div className="relative mb-6">
               <span className="absolute left-4 top-[14px] text-gray-500 text-sm">R$</span>
               <input type="number" step="0.01" value={cashAdjustmentValue} onChange={(e) => setCashAdjustmentValue(e.target.value)} placeholder="0.00" className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-emerald-500/50" autoFocus />
            </div>

            <div className="flex gap-3">
              <button onClick={() => handleCashAdjustment('remove')} disabled={!cashAdjustmentValue} className="flex-1 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold text-xs hover:bg-red-500/20 disabled:opacity-50 transition-colors flex justify-center items-center gap-1.5"><TrendingDown size={14}/> Retirar</button>
              <button onClick={() => handleCashAdjustment('add')} disabled={!cashAdjustmentValue} className="flex-1 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-xs hover:bg-emerald-500/20 disabled:opacity-50 transition-colors flex justify-center items-center gap-1.5"><TrendingUp size={14}/> Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {labelPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white text-black w-[300px] rounded-xl shadow-2xl flex flex-col items-center relative overflow-hidden p-6">
            <div className="text-center mb-6 w-full border-b-2 border-dashed border-gray-300 pb-4">
              <h2 className="text-xl font-black uppercase tracking-widest text-black">ScrapSys</h2>
              <p className="text-[10px] text-gray-500 uppercase">Etiqueta de Identificação</p>
            </div>
            <h3 className="font-bold text-2xl text-center mb-2 uppercase">{labelPreview.name}</h3>
            <div className="flex flex-col items-center gap-1 my-4 bg-gray-100 p-4 rounded-lg w-full">
              <Barcode size={70} strokeWidth={2} className="text-black" />
              <span className="font-mono text-sm tracking-[0.3em] font-bold">{labelPreview.code}</span>
            </div>
            <span className="font-bold text-lg text-emerald-700 bg-emerald-100 px-4 py-1 rounded-full mt-2">
              {formatCurrency(labelPreview.price)}/kg
            </span>
            <div className="flex gap-3 w-full mt-8">
              <button onClick={() => setLabelPreview(null)} className="flex-1 py-3 bg-gray-200 text-gray-800 font-bold rounded-xl hover:bg-gray-300 transition-colors">Cancelar</button>
              <button onClick={confirmPrintLabel} className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-lg hover:bg-indigo-500 transition-colors"><Printer size={18} /> Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {receiptTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#f4f4f4] text-gray-900 w-full max-w-[320px] rounded-t-lg shadow-2xl flex flex-col font-mono relative filter drop-shadow-2xl">
            <div className="h-2 w-full bg-[radial-gradient(circle,transparent_4px,#f4f4f4_5px)] bg-[length:12px_12px] -top-1.5 absolute rotate-180"></div>
            <div className="h-2 w-full bg-[radial-gradient(circle,transparent_4px,#f4f4f4_5px)] bg-[length:12px_12px] -bottom-1.5 absolute z-10"></div>
            <div className="p-6 pt-8 pb-10 flex flex-col">
              <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
                <h2 className="text-xl font-black uppercase tracking-widest mb-1 text-black">ScrapSys</h2>
                <p className="text-[10px] text-gray-500 uppercase">Gestão Inteligente de Ferro-Velho</p>
              </div>
              <div className="text-[11px] space-y-1.5 border-b-2 border-dashed border-gray-300 pb-4 mb-4 font-bold text-gray-700">
                <div className="flex justify-between"><span>DATA/HORA:</span><span>{formatDateTime(receiptTx.date)}</span></div>
                <div className="flex justify-between"><span>RECIBO:</span><span>#{receiptTx.id.toUpperCase()}</span></div>
              </div>
              <div className="border-b-2 border-dashed border-gray-300 pb-4 mb-4">
                <div className="flex justify-between text-[11px] font-black mb-2 text-black"><span className="w-1/2">DESCRIÇÃO</span><span className="w-1/4 text-right">QTD</span><span className="w-1/4 text-right">TOTAL</span></div>
                <div className="space-y-3">
                  {receiptTx.items?.map((item, idx) => (
                    <div key={idx} className="flex flex-col">
                      <div className="flex justify-between text-sm font-bold text-gray-800">
                        <span className="w-1/2 truncate pr-2">{item.scrap} <span className="text-[9px] text-gray-400 font-normal">#{item.code}</span></span><span className="w-1/4 text-right">{item.weight}kg</span><span className="w-1/4 text-right">{formatCurrency(item.total)}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">Val. Unit: {formatCurrency(item.pricePerKg)}/kg</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center text-lg font-black mb-8 text-black">
                <span>TOTAL PAGO</span><span>{formatCurrency(receiptTx.total)}</span>
              </div>
              <div className="flex flex-col items-center gap-2 mt-auto">
                <Barcode size={50} strokeWidth={1.5} className="text-gray-800 opacity-80" />
                <p className="text-[9px] text-gray-400 text-center uppercase leading-tight mt-2">Obrigado pela preferência!<br/>Guarde este recibo.</p>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-16 left-0 right-0 flex gap-3 px-4 z-20">
              <button onClick={() => setReceiptTx(null)} className="flex-1 py-3 bg-zinc-800 text-white font-bold rounded-xl shadow-xl hover:bg-zinc-700 transition-colors">Fechar</button>
              <button onClick={printReceipt} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-xl hover:bg-emerald-500 transition-colors"><Printer size={18} /> Imprimir</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
      `}} />
    </div>
  );
}