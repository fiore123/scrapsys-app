import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Scale, Barcode, DollarSign, History, TrendingUp, TrendingDown, 
  Settings, Bluetooth, BluetoothConnected, Plus, Wallet, 
  Search, Edit3, CheckCircle, Trash2, Printer,
  Home, PieChart, PackagePlus, Tag, QrCode,
  ChevronRight, ChevronDown, Usb, Wifi, MonitorSmartphone, Server,
  FileText, Users, UserPlus, Shield, Copy, Mail, Key, Power, PowerOff, X,
  LogOut, CalendarClock, RefreshCw, Download, Info, MoreHorizontal,
  Truck, MessageCircle, Upload, Database
} from 'lucide-react';
import {
  getNativeAppVersion,
  getAutomaticSyncSettings,
  connectCloudSync,
  disconnectCloudSync,
  ensureCloudSyncReady,
  exportBackup,
  getCloudSyncUser,
  importBackup,
  isNativeMobile,
  loadLocalData,
  noteLocalDataChanged,
  runCloudSync,
  runAutomaticSync,
  saveAutomaticSyncSettings,
  saveLocalData,
  tapFeedback
} from './platform';
import scrapSysLogo from './assets/logo-scrap.png';
import scrapSysMark from './assets/logo-scrap-mark.png';

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

const INITIAL_SCALE = [
  { id: 'sc_1', name: 'Balança Principal', type: 'bluetooth', isConnected: false }
];

const DEFAULT_ADMIN_PASSWORD = String(100000 + 23456);
const PASSWORD_ALGORITHM = 'pbkdf2-sha256';
const PASSWORD_ITERATIONS = 210000;

const getInitialValidDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
};

const INITIAL_USERS = [
  {
    id: 'admin_root',
    cpf: '00000000000',
    name: 'Administrador Chefe',
    email: 'admin@scrapsys.com',
    login: 'admin',
    password: DEFAULT_ADMIN_PASSWORD,
    role: 'admin',
    isActive: true,
    mustChangePassword: true,
    validUntil: '2099-12-31T23:59:59.000Z'
  }
];

const textEncoder = new TextEncoder();

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const generateSalt = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${globalThis.crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;

const createSecureId = (prefix = '') =>
  `${prefix}${globalThis.crypto?.randomUUID?.() || globalThis.crypto.getRandomValues(new Uint32Array(2)).join('')}`;

const legacyHashPassword = async (password, salt) => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', textEncoder.encode(`${salt}:${password}`));
  return toHex(digest);
};

const hashPassword = async (password, salt, iterations = PASSWORD_ITERATIONS) => {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const digest = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: textEncoder.encode(salt),
      iterations,
      hash: 'SHA-256'
    },
    key,
    256
  );
  return toHex(digest);
};

const createPasswordFields = async (password) => {
  const passwordSalt = generateSalt();
  return {
    passwordSalt,
    passwordHash: await hashPassword(password, passwordSalt),
    passwordAlgo: PASSWORD_ALGORITHM,
    passwordIterations: PASSWORD_ITERATIONS
  };
};

const verifyUserPassword = async (user, password) => {
  if (user.passwordHash && user.passwordSalt) {
    if (user.passwordAlgo === PASSWORD_ALGORITHM) {
      const iterations = Number(user.passwordIterations || PASSWORD_ITERATIONS);
      return (await hashPassword(password, user.passwordSalt, iterations)) === user.passwordHash;
    }
    return (await legacyHashPassword(password, user.passwordSalt)) === user.passwordHash;
  }
  return user.password === password;
};

const shouldUpgradePassword = (user) =>
  Boolean(user.password || user.passwordAlgo !== PASSWORD_ALGORITHM || Number(user.passwordIterations || 0) < PASSWORD_ITERATIONS);

const removePlainPassword = (user) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

const normalizeUsersForStorage = async (users) =>
  Promise.all(
    users.map(async (user) => {
      if (user.password && !user.passwordHash) {
        return removePlainPassword({ ...user, ...(await createPasswordFields(user.password)) });
      }
      return removePlainPassword(user);
    })
  );

const INITIAL_PRINTERS = [
  { id: 'pr_1', name: 'Bematech Térmica 80mm', type: 'receipt', isDefault: true },
  { id: 'pr_2', name: 'Zebra Argox 214', type: 'label', isDefault: true },
  { id: 'pr_3', name: 'Epson EcoTank L3150', type: 'a4', isDefault: true }
];

const loadData = async (key, defaultData) => {
  try {
    if (window.electronAPI && window.electronAPI.loadData) {
      const data = await window.electronAPI.loadData(key);
      return data ?? defaultData;
    }

    const saved = await loadLocalData(key);
    return saved ?? defaultData;
  } catch (e) {
    console.error(`Erro ao carregar ${key}:`, e);
    return defaultData;
  }
};

const saveData = async (key, data) => {
  try {
    if (window.electronAPI && window.electronAPI.saveData) {
      await window.electronAPI.saveData(key, data);
      await noteLocalDataChanged(key);
      return true;
    }

    await saveLocalData(key, data);
    return true;
  } catch (e) {
    console.error(`Erro ao salvar ${key}:`, e);
    return false;
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginCpf, setLoginCpf] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [activeTab, setActiveTab] = useState('home');

  const [scraps, setScraps] = useState(INITIAL_SCRAPS);
  const [transactions, setTransactions] = useState([]);
  const [initialCash, setInitialCash] = useState(0);

  const [isEditingCash, setIsEditingCash] = useState(false);
  const [tempCash, setTempCash] = useState(0);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [cashAdjustmentValue, setCashAdjustmentValue] = useState('');
  
  const [toast, setToast] = useState({ visible: false, message: '' });

  const showToast = (message) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 3500);
  };
  
  const codeInputRef = useRef(null);
  const backupInputRef = useRef(null);

  const [weight, setWeight] = useState('');
  const [code, setCode] = useState('');
  const [selectedScrap, setSelectedScrap] = useState(null);
  const [pricePerKg, setPricePerKg] = useState(0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  
  const [scales, setScales] = useState(INITIAL_SCALE);
  const [activeScaleId, setActiveScaleId] = useState('sc_1');
  const [scaleLocked, setScaleLocked] = useState(false);

  const [printers, setPrinters] = useState(INITIAL_PRINTERS);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterType, setNewPrinterType] = useState('receipt');

  const [newScaleType, setNewScaleType] = useState('bluetooth');
  const [newScaleName, setNewScaleName] = useState('');
  const [newScaleIp, setNewScaleIp] = useState('');
  const [isSearchingDevice, setIsSearchingDevice] = useState(false);

  const [isScaleDropdownOpen, setIsScaleDropdownOpen] = useState(false);
  const [isMobileScrapDropdownOpen, setIsMobileScrapDropdownOpen] = useState(false);

  const currentScale = scales.find(s => s.id === activeScaleId);
  const scaleConnected = currentScale?.isConnected || false;

  const [usersList, setUsersList] = useState(INITIAL_USERS);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  
  const [newUserCpf, setNewUserCpf] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  
  const [extendModalUserId, setExtendModalUserId] = useState(null);
  const [extendDaysValue, setExtendDaysValue] = useState(30);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isSyncingData, setIsSyncingData] = useState(false);
  const [automaticSync, setAutomaticSync] = useState({ enabled: false, serverUrl: '', pairingCode: '' });
  const [syncServerInfo, setSyncServerInfo] = useState(null);
  const [automaticSyncStatus, setAutomaticSyncStatus] = useState('idle');
  const [cloudSync, setCloudSync] = useState({ enabled: true });
  const [cloudSyncStatus, setCloudSyncStatus] = useState('idle');
  const [cloudSyncUser, setCloudSyncUser] = useState(null);
  const [cloudSyncEmail, setCloudSyncEmail] = useState('');
  const [cloudSyncPassword, setCloudSyncPassword] = useState('');
  const [cloudLastSync, setCloudLastSync] = useState(null);
  const syncReloadingRef = useRef(false);

  const [appVersion, setAppVersion] = useState('1.0.X');

  const [newScrapName, setNewScrapName] = useState('');
  const [newScrapPrice, setNewScrapPrice] = useState('');
  const [currentItems, setCurrentItems] = useState([]);
  const [isPriceListOpen, setIsPriceListOpen] = useState(false);
  const [isInventoryListOpen, setIsInventoryListOpen] = useState(false);
  const [receiptTx, setReceiptTx] = useState(null);
  const [labelPreview, setLabelPreview] = useState(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isScrapFormOpen, setIsScrapFormOpen] = useState(false);
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false);

  // === NOVO: ESTADOS DOS FORNECEDORES ===
  const [suppliers, setSuppliers] = useState([]);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierScrapCode, setNewSupplierScrapCode] = useState('');
  const [newSupplierTargetKg, setNewSupplierTargetKg] = useState('');
  const [isScrapDropdownOpen, setIsScrapDropdownOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      const loadedUsers = await loadData('global_usersList', INITIAL_USERS);
      const safeUsers = Array.isArray(loadedUsers) ? loadedUsers : INITIAL_USERS;
      const hasAdmin = safeUsers.some(u => u.role === 'admin');
      const usersWithAdmin = hasAdmin ? safeUsers : [INITIAL_USERS[0], ...safeUsers];
      const normalizedUsers = await normalizeUsersForStorage(usersWithAdmin);

      if (!isMounted) return;

      setUsersList(normalizedUsers);
      setUsersLoaded(true);
    };

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (usersLoaded) saveData('global_usersList', usersList);
  }, [usersList, usersLoaded]);

  useEffect(() => {
    const loadVersion = async () => {
      try {
        if (window.electronAPI && window.electronAPI.getVersion) {
          const version = await window.electronAPI.getVersion();
          setAppVersion(version);
        } else {
          setAppVersion(await getNativeAppVersion('1.2.13'));
        }
      } catch (error) {
        console.error('Erro ao obter versão:', error);
      }
    };

    loadVersion();
  }, []);

  useEffect(() => {
    if (isNativeMobile) {
      getAutomaticSyncSettings().then((settings) => {
        if (settings) setAutomaticSync(settings);
      });
      return;
    }

    window.electronAPI?.getSyncServerInfo?.().then(setSyncServerInfo);
  }, []);

  useEffect(() => {
    let active = true;

    const loadCloudSync = async () => {
      try {
        const user = await getCloudSyncUser();
        if (!user) {
          if (active) setCloudSyncStatus('idle');
          return;
        }
        if (!active) return;
        setCloudSync({ enabled: true });
        setCloudSyncUser(user);
        setCloudSyncStatus('connecting');
        const result = await runCloudSync();
        if (!active) return;
        setCloudSyncStatus('connected');
        if (result.ok) setCloudLastSync(new Date());
        if (result.changed && !syncReloadingRef.current) {
          syncReloadingRef.current = true;
          showToast('Dados recebidos da nuvem. Atualizando...');
          setTimeout(() => window.location.reload(), 600);
        }
      } catch (error) {
        console.warn('Firebase indisponivel:', error);
        if (active) {
          setCloudSyncUser(null);
          setCloudSyncStatus('offline');
        }
      }
    };

    loadCloudSync();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!cloudSync.enabled || !cloudSyncUser) return;

    let active = true;
    const synchronize = async () => {
      try {
        const result = await runCloudSync();
        if (!active) return;
        setCloudSyncStatus(result.ok ? 'connected' : 'offline');
        if (result.ok) setCloudLastSync(new Date());
        if (result.changed && !syncReloadingRef.current) {
          syncReloadingRef.current = true;
          showToast('Dados recebidos da nuvem. Atualizando...');
          setTimeout(() => window.location.reload(), 600);
        }
      } catch (error) {
        if (active) setCloudSyncStatus('offline');
        console.warn('Firebase indisponivel:', error);
      }
    };

    synchronize();
    const interval = setInterval(synchronize, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [cloudSync, cloudSyncUser]);

  useEffect(() => {
    if (!isNativeMobile || !automaticSync.enabled) return;

    let active = true;
    const synchronize = async () => {
      try {
        const result = await runAutomaticSync(automaticSync);
        if (!active) return;
        setAutomaticSyncStatus(result.ok ? 'connected' : 'idle');
        if (result.changed && !syncReloadingRef.current) {
          syncReloadingRef.current = true;
          showToast('Dados recebidos do PC. Atualizando...');
          setTimeout(() => window.location.reload(), 600);
        }
      } catch (error) {
        if (active) setAutomaticSyncStatus('offline');
        console.warn('PC de sincronizacao indisponivel:', error);
      }
    };

    synchronize();
    const interval = setInterval(synchronize, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [automaticSync]);

  useEffect(() => {
    if (!window.electronAPI?.onSyncDataChanged) return;
    return window.electronAPI.onSyncDataChanged(() => {
      if (syncReloadingRef.current) return;
      syncReloadingRef.current = true;
      showToast('Dados recebidos do celular. Atualizando...');
      setTimeout(() => window.location.reload(), 600);
    });
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    setLoadedUserId(null);

    const loadUserData = async () => {
      const userKey = currentUser.id;

      const loadedScraps = await loadData(`${userKey}_scraps`, INITIAL_SCRAPS);
      const loadedTransactions = await loadData(`${userKey}_transactions`, []);
      const loadedInitialCash = await loadData(`${userKey}_initialCash`, 0);
      const loadedScales = await loadData(`${userKey}_scales`, INITIAL_SCALE);
      const loadedPrinters = await loadData(`${userKey}_printers`, INITIAL_PRINTERS);
      const loadedSuppliers = await loadData(`${userKey}_suppliers`, []); // Carrega os fornecedores

      if (!isMounted) return;

      setScraps(Array.isArray(loadedScraps) ? loadedScraps : INITIAL_SCRAPS);
      setTransactions(Array.isArray(loadedTransactions) ? loadedTransactions : []);
      setInitialCash(typeof loadedInitialCash === 'number' ? loadedInitialCash : 0);
      setTempCash(typeof loadedInitialCash === 'number' ? loadedInitialCash : 0);
      setScales(Array.isArray(loadedScales) ? loadedScales : INITIAL_SCALE);
      setPrinters(Array.isArray(loadedPrinters) ? loadedPrinters : INITIAL_PRINTERS);
      setSuppliers(Array.isArray(loadedSuppliers) ? loadedSuppliers : []);

      const safeScales = Array.isArray(loadedScales) ? loadedScales : INITIAL_SCALE;
      setActiveScaleId(safeScales[0]?.id || 'sc_1');
      setScaleLocked(false);
      setWeight('');
      setCode('');
      setSelectedScrap(null);
      setCurrentItems([]);
      setLoadedUserId(currentUser.id);
    };

    loadUserData();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && loadedUserId === currentUser.id) saveData(`${currentUser.id}_scraps`, scraps);
  }, [scraps, currentUser, loadedUserId]);

  useEffect(() => {
    if (currentUser && loadedUserId === currentUser.id) saveData(`${currentUser.id}_transactions`, transactions);
  }, [transactions, currentUser, loadedUserId]);

  useEffect(() => {
    if (currentUser && loadedUserId === currentUser.id) saveData(`${currentUser.id}_initialCash`, initialCash);
  }, [initialCash, currentUser, loadedUserId]);

  useEffect(() => {
    if (currentUser && loadedUserId === currentUser.id) saveData(`${currentUser.id}_scales`, scales);
  }, [scales, currentUser, loadedUserId]);

  useEffect(() => {
    if (currentUser && loadedUserId === currentUser.id) saveData(`${currentUser.id}_printers`, printers);
  }, [printers, currentUser, loadedUserId]);

  // Salvar fornecedores no banco de dados local
  useEffect(() => {
    if (currentUser && loadedUserId === currentUser.id) saveData(`${currentUser.id}_suppliers`, suppliers);
  }, [suppliers, currentUser, loadedUserId]);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onUpdateAvailable) {
      const removeListener = window.electronAPI.onUpdateAvailable(() => {
        setUpdateAvailable(true);
      });

      return () => {
        if (typeof removeListener === 'function') {
          removeListener();
        }
      };
    }
  }, []);

  const handleApplyUpdate = () => {
    if (isNativeMobile) {
      showToast("No Android, instale a nova versao pela Play Store ou por um APK assinado.");
      setUpdateAvailable(false);
      return;
    }

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

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);

    try {
      if (isNativeMobile) {
        showToast("Android: atualizacoes sao distribuidas pela Play Store ou por APK assinado.");
        return;
      }

      if (window.electronAPI && window.electronAPI.checkForUpdates) {
        const result = await window.electronAPI.checkForUpdates();

        if (result?.ok === false) {
          showToast(result.message || "Não foi possível verificar atualizações.");
        } else {
          showToast("Verificação enviada ao servidor.");
        }
      } else {
        showToast("Simulação: O sistema já está na versão mais recente.");
      }
    } catch (error) {
      console.error("Erro ao verificar atualizações:", error);
      showToast("Erro ao verificar atualizações.");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleExportBackup = async () => {
    setIsSyncingData(true);
    try {
      const fileName = await exportBackup();
      showToast(`Backup criado: ${fileName}`);
    } catch (error) {
      console.error('Erro ao exportar backup:', error);
      showToast('Nao foi possivel criar o backup.');
    } finally {
      setIsSyncingData(false);
    }
  };

  const handleEnableAutomaticSync = async () => {
    const settings = {
      ...automaticSync,
      enabled: true,
      serverUrl: automaticSync.serverUrl.trim().replace(/\/$/, ''),
      pairingCode: automaticSync.pairingCode.trim()
    };

    if (!/^https?:\/\//i.test(settings.serverUrl) || settings.pairingCode.length < 12) {
      showToast('Informe o endereco do PC e o codigo seguro de pareamento.');
      return;
    }

    setIsSyncingData(true);
    setAutomaticSyncStatus('connecting');
    try {
      await saveAutomaticSyncSettings(settings);
      const result = await runAutomaticSync(settings);
      setAutomaticSync(settings);
      setAutomaticSyncStatus('connected');
      showToast('Sincronizacao automatica conectada.');
      if (result.changed) setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      console.error('Erro ao parear com o PC:', error);
      setAutomaticSyncStatus('offline');
      showToast('Nao foi possivel conectar. Confira Wi-Fi, endereco e codigo.');
    } finally {
      setIsSyncingData(false);
    }
  };

  const handleDisableAutomaticSync = async () => {
    const settings = { ...automaticSync, enabled: false };
    await saveAutomaticSyncSettings(settings);
    setAutomaticSync(settings);
    setAutomaticSyncStatus('idle');
    showToast('Sincronizacao automatica desativada.');
  };

  const handleRunCloudSyncNow = async () => {
    setIsSyncingData(true);
    setCloudSyncStatus('connecting');
    try {
      const user = await ensureCloudSyncReady();
      setCloudSyncUser(user);
      const result = await runCloudSync();
      setCloudSyncStatus('connected');
      setCloudLastSync(new Date());
      showToast('Sincronizacao em nuvem atualizada.');
      if (result.changed) setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      console.error('Erro na sincronizacao Firebase:', error);
      setCloudSyncStatus('offline');
      showToast(error?.message || 'Nao foi possivel sincronizar com a nuvem.');
    } finally {
      setIsSyncingData(false);
    }
  };

  const handleConnectCloudSync = async () => {
    setIsSyncingData(true);
    setCloudSyncStatus('connecting');
    try {
      const user = await connectCloudSync(cloudSyncEmail, cloudSyncPassword);
      setCloudSyncUser(user);
      setCloudSyncPassword('');
      const result = await runCloudSync();
      setCloudSyncStatus('connected');
      setCloudLastSync(new Date());
      showToast('Cofre seguro conectado e sincronizado.');
      if (result.changed) setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      console.error('Erro ao conectar sincronizacao segura:', error);
      setCloudSyncStatus('offline');
      showToast(error?.message || 'Nao foi possivel conectar ao Firebase.');
    } finally {
      setIsSyncingData(false);
    }
  };

  const handleDisconnectCloudSync = async () => {
    setIsSyncingData(true);
    try {
      await disconnectCloudSync();
      setCloudSync({ enabled: true });
      setCloudSyncUser(null);
      setCloudSyncStatus('idle');
      setCloudSyncPassword('');
      showToast('Sessao segura removida deste dispositivo.');
    } catch (error) {
      console.error('Erro ao sair do Firebase:', error);
      showToast('Nao foi possivel sair da nuvem.');
    } finally {
      setIsSyncingData(false);
    }
  };

  const handleImportBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsSyncingData(true);
    try {
      const payload = JSON.parse(await file.text());
      const confirmed = window.confirm(
        'Importar este backup substituirá todos os dados atuais deste dispositivo. Deseja continuar?'
      );
      if (!confirmed) return;

      await importBackup(payload);
      showToast('Dados importados. O ScrapSys sera reiniciado.');
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      console.error('Erro ao importar backup:', error);
      showToast(error?.message || 'Arquivo de backup invalido.');
    } finally {
      setIsSyncingData(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();

    if (cloudSyncStatus !== 'connected') {
      handleRunCloudSyncNow();
    }

    const foundUser = usersList.find(u => u.login === loginCpf);
    
    if (foundUser && await verifyUserPassword(foundUser, loginPass)) {
      if (!foundUser.isActive) {
        showToast("Este usuário foi desativado pelo administrador.");
        return;
      }

      if (new Date() > new Date(foundUser.validUntil)) {
        showToast("Licença offline expirada. Contate o administrador.");
        return;
      }

      let safeUser = foundUser;
      if (shouldUpgradePassword(foundUser)) {
        const passwordFields = await createPasswordFields(loginPass);
        safeUser = removePlainPassword({ ...foundUser, ...passwordFields });
        setUsersList(usersList.map(u => u.id === foundUser.id ? safeUser : u));
      }

      setCurrentUser(safeUser);
      setLoginCpf('');
      setLoginPass('');
      setActiveTab(safeUser.mustChangePassword ? 'settings' : 'home');
      if (safeUser.mustChangePassword) {
        showToast('Troque a senha padrao do administrador para proteger o app.');
      }
    } else {
      showToast("Credenciais incorretas ou não encontradas.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('home');
    setIsMoreMenuOpen(false);
    setCurrentItems([]);
    setWeight('');
    setCode('');
    setSelectedScrap(null);
    setScaleLocked(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!await verifyUserPassword(currentUser, currentPasswordInput)) {
      showToast("Senha atual incorreta.");
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      showToast("As novas senhas não coincidem.");
      return;
    }

    if (newPasswordInput.length < 10) {
      showToast("A nova senha deve ter no minimo 10 caracteres.");
      return;
    }

    const passwordFields = await createPasswordFields(newPasswordInput);
    const updatedCurrentUser = removePlainPassword({ ...currentUser, ...passwordFields, mustChangePassword: false });
    const updatedUsers = usersList.map(u =>
      u.id === currentUser.id ? updatedCurrentUser : u
    );

    setUsersList(updatedUsers);
    setCurrentUser(updatedCurrentUser);
    
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    showToast("Senha alterada com sucesso!");
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
      id: createSecureId('id_'),
      name: newScaleName,
      type: newScaleType,
      ip: newScaleType === 'rj45' ? newScaleIp : null,
      isConnected: false 
    };

    setScales([...scales, newScale]);
    setNewScaleName('');
    setNewScaleIp('');

    if (scales.length === 0) setActiveScaleId(newScale.id);

    showToast("Balança adicionada.");
  };

  const toggleScaleConnection = (id) => {
    setScales(scales.map(s => s.id === id ? { ...s, isConnected: !s.isConnected } : s));
  };
  
  const handleDeleteScale = (id) => {
    const filtered = scales.filter(s => s.id !== id);
    setScales(filtered);

    if (activeScaleId === id) {
      setActiveScaleId(filtered.length > 0 ? filtered[0].id : '');
    }

    showToast("Balança removida.");
  };

  const handleAddPrinter = (e) => {
    e.preventDefault();

    if (!newPrinterName) return;

    const isFirstOfType = !printers.some(p => p.type === newPrinterType);

    const newPrinter = {
      id: createSecureId('id_'),
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

  // === MÓDULO DE FORNECEDORES ===
  const handleAddSupplier = (e) => {
    e.preventDefault();
    if (!newSupplierName || !newSupplierPhone || !newSupplierScrapCode || !newSupplierTargetKg) {
      showToast("Por favor, preencha todos os campos e selecione o material.");
      return;
    }

    const scrapRef = scraps.find(s => s.code === newSupplierScrapCode);
    if (!scrapRef) return;

    const newSupplier = {
      id: createSecureId('id_'),
      name: newSupplierName,
      phone: newSupplierPhone.replace(/\D/g, ''), // Limpa qualquer máscara
      scrapCode: scrapRef.code,
      scrapName: scrapRef.name,
      targetKg: parseFloat(newSupplierTargetKg)
    };

    setSuppliers([...suppliers, newSupplier]);
    setNewSupplierName('');
    setNewSupplierPhone('');
    setNewSupplierScrapCode('');
    setNewSupplierTargetKg('');
    setIsSupplierFormOpen(false);
    showToast("Fornecedor registado com sucesso.");
  };

  const handleDeleteSupplier = (id) => {
    setSuppliers(suppliers.filter(s => s.id !== id));
    showToast("Fornecedor removido.");
  };

  const sendWhatsAppMessage = (supplier, currentInventoryKg) => {
    const message = `Olá ${supplier.name}, o ScrapSys informa que já temos ${currentInventoryKg.toFixed(1)}kg de ${supplier.scrapName} separados em estoque para a sua coleta.`;
    // Colocamos o 55 para o Brasil se quiser, ou deixa genérico
    const url = `https://wa.me/55${supplier.phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$&*';
    const random = new Uint32Array(14);
    globalThis.crypto.getRandomValues(random);
    let pass = '';

    for (let i = 0; i < random.length; i++) {
      pass += chars.charAt(random[i] % chars.length);
    }

    return pass;
  };

  const handleGenerateUser = async (e) => {
    e.preventDefault();

    if (!newUserCpf || !newUserName || !newUserEmail) return;

    const loginNumber = newUserCpf.replace(/\D/g, '');

    if (loginNumber.length < 11) {
      showToast("CPF/CNPJ inválido.");
      return;
    }

    const password = generateRandomPassword();
    const passwordFields = await createPasswordFields(password);
    
    const newUser = {
      id: createSecureId('id_'),
      cpf: newUserCpf,
      name: newUserName,
      email: newUserEmail,
      login: loginNumber,
      ...passwordFields,
      role: 'user',
      isActive: true,
      validUntil: getInitialValidDate()
    };

    setUsersList([...usersList, newUser]);
    setGeneratedCredentials({
      login: loginNumber,
      password,
      name: newUserName,
      email: newUserEmail
    });

    setNewUserCpf('');
    setNewUserName('');
    setNewUserEmail('');
    setTimeout(() => runCloudSync().catch((error) => console.warn('Sync apos criar usuario:', error)), 300);
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

  const handleResetUserPassword = async (user) => {
    const newPass = generateRandomPassword();
    const passwordFields = await createPasswordFields(newPass);

    setUsersList(usersList.map(u => u.id === user.id ? removePlainPassword({ ...u, ...passwordFields }) : u));

    setGeneratedCredentials({
      login: user.login,
      password: newPass,
      name: user.name,
      email: user.email
    });

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

  const handleSelectMobileScrap = (scrap) => {
    setCode(scrap.code);
    setSelectedScrap(scrap);
    if (!isCustomPrice) setPricePerKg(scrap.price);
    setIsMobileScrapDropdownOpen(false);
  };

  const totalValue = useMemo(() => {
    return (parseFloat(weight) || 0) * pricePerKg;
  }, [weight, pricePerKg]);

  const cartTotal = useMemo(() => {
    return currentItems.reduce((acc, item) => acc + item.total, 0);
  }, [currentItems]);

  const grandTotal = cartTotal + totalValue;

  const stats = useMemo(() => {
    const now = new Date();

    let daily = 0;
    let weekly = 0;
    let monthly = 0;
    let totalSpent = 0;
    let totalWeightKG = 0;
    let inventoryMap = {};

    transactions.forEach(t => {
      if (currentUser?.role === 'user' && t.userId !== currentUser.id) return;

      const tDate = new Date(t.date);
      totalSpent += t.total;

      if (t.items) {
        t.items.forEach(item => {
          totalWeightKG += item.weight;

          if (!inventoryMap[item.code]) {
            inventoryMap[item.code] = {
              code: item.code,
              name: item.scrap,
              weight: 0
            };
          }

          inventoryMap[item.code].weight += item.weight;
        });
      }

      if (tDate.toDateString() === now.toDateString()) daily += t.total;

      const diffTime = Math.abs(now - tDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 7) weekly += t.total;

      if (tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()) {
        monthly += t.total;
      }
    });

    return { 
      daily,
      weekly,
      monthly,
      totalSpent,
      currentCash: initialCash - totalSpent,
      totalWeightTon: (totalWeightKG / 1000).toFixed(3),
      inventoryByCategory: Object.values(inventoryMap).sort((a, b) => b.weight - a.weight),
      inventoryMap // Correção fundamental: Permite que a aba de Fornecedores encontre o peso!
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
      id: createSecureId('id_'),
      scrap: selectedScrap.name,
      code: selectedScrap.code,
      weight: parseFloat(weight),
      pricePerKg,
      total: totalValue
    }]);

    setWeight('');
    setCode('');
    setSelectedScrap(null);
    setIsCustomPrice(false);
    setScaleLocked(false);
  };

  const handleRemoveItem = (id) => {
    setCurrentItems(currentItems.filter(item => item.id !== id));
  };

  const handleFinalize = () => {
    let finalItems = [...currentItems];

    if (selectedScrap && weight && parseFloat(weight) > 0) {
      finalItems.push({
        id: createSecureId('id_'),
        scrap: selectedScrap.name,
        code: selectedScrap.code,
        weight: parseFloat(weight),
        pricePerKg,
        total: totalValue
      });
    }

    if (finalItems.length === 0) return;

    setTransactions([{
      id: createSecureId('id_'),
      userId: currentUser.id,
      userName: currentUser.name,
      date: new Date().toISOString(),
      items: finalItems,
      total: finalItems.reduce((acc, item) => acc + item.total, 0)
    }, ...transactions]);
    
    setCurrentItems([]);
    setWeight('');
    setCode('');
    setSelectedScrap(null);
    setIsCustomPrice(false);
    setScaleLocked(false);

    showToast("Compra finalizada!");

    setTimeout(() => {
      if (codeInputRef.current) codeInputRef.current.focus();
    }, 50);
  };

  const handleRegisterScrap = (e) => {
    e.preventDefault();

    if (!newScrapName || !newScrapPrice) return;

    const maxCode = scraps.reduce((max, s) => {
      return Math.max(max, !isNaN(parseInt(s.code, 10)) ? parseInt(s.code, 10) : 0);
    }, 0);

    setScraps([
      ...scraps,
      {
        code: String(maxCode + 1).padStart(3, '0'),
        name: newScrapName,
        price: parseFloat(newScrapPrice)
      }
    ]);

    setNewScrapName('');
    setNewScrapPrice('');
    setIsScrapFormOpen(false);
    showToast("Material cadastrado com sucesso.");
  };

  const handleDeleteScrap = (codeToRemove) => {
    setScraps(scraps.filter(s => s.code !== codeToRemove));
    showToast("Material removido.");
  };
  
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };
  
  const formatDateTime = (isoString) => {
    const d = new Date(isoString);

    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
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
    (u.name || '').toLowerCase().includes(userSearchTerm.toLowerCase()) || 
    (u.login || '').includes(userSearchTerm) || 
    (u.cpf || '').includes(userSearchTerm)
  );

  const tabContent = {
    home: {
      title: 'Pesagem rapida',
      description: 'Registre compras com foco no fluxo do patio.',
      icon: Scale
    },
    finance: {
      title: 'Financeiro',
      description: 'Acompanhe caixa, entradas e saidas do dia.',
      icon: PieChart
    },
    register: {
      title: 'Materiais',
      description: 'Atualize tipos de sucata, codigos e precos.',
      icon: PackagePlus
    },
    suppliers: {
      title: 'Fornecedores',
      description: 'Organize compradores, contatos e metas.',
      icon: Truck
    },
    settings: {
      title: 'Configuracoes',
      description: 'Controle conexoes, backup, nuvem e dispositivos.',
      icon: Settings
    },
    users: {
      title: 'Usuarios',
      description: 'Gerencie acessos e validade das contas.',
      icon: Shield
    },
    faq: {
      title: 'Ajuda',
      description: 'Consulte orientacoes rapidas para operar melhor.',
      icon: Info
    }
  };
  const activeTabInfo = tabContent[activeTab] || tabContent.home;
  const ActiveTabIcon = activeTabInfo.icon;
  const cloudStatusLabel = cloudSyncStatus === 'connected'
    ? 'Nuvem ativa'
    : cloudSyncStatus === 'connecting'
      ? 'Conectando'
      : cloudSyncStatus === 'offline'
        ? 'Nuvem offline'
        : 'Nuvem pausada';
  const cloudStatusClass = cloudSyncStatus === 'connected'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : cloudSyncStatus === 'offline'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      : 'bg-white/5 text-gray-400 border-white/10';

  const renderNavButton = (tab, label, Icon, tone = 'emerald') => {
    const isActive = activeTab === tab;
    const activeClass = tone === 'indigo'
      ? 'bg-zinc-800 text-indigo-400 shadow-md border border-white/10'
      : 'bg-zinc-800 text-emerald-400 shadow-md border border-white/10';
    const inactiveClass = tone === 'indigo'
      ? 'text-indigo-500/60 hover:text-indigo-400 hover:bg-white/5 border border-transparent'
      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent';

    return (
      <button
        onClick={() => {
          setActiveTab(tab);
          setIsMoreMenuOpen(false);
        }}
        title={label}
        className={`min-w-[4rem] md:min-w-0 px-2 py-2.5 md:p-3 shrink-0 rounded-xl md:rounded-lg transition-all flex flex-col md:flex-row items-center justify-center gap-1 ${isActive ? activeClass : inactiveClass}`}
      >
        <Icon size={21} />
        <span className="text-[10px] font-black leading-none md:hidden">{label}</span>
      </button>
    );
  };

  const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction }) => (
    <div className="min-h-[220px] flex flex-col items-center justify-center text-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 py-10">
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-gray-500 flex items-center justify-center mb-4">
        <Icon size={26} />
      </div>
      <h3 className="text-base font-black text-gray-300">{title}</h3>
      <p className="text-sm text-gray-500 mt-2 max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="mt-5 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all">
          {actionLabel}
        </button>
      )}
    </div>
  );

  const MobileSheet = ({ open, title, icon: Icon, onClose, children }) => {
    if (!open) return null;

    return (
      <div className="fixed inset-0 z-[160] md:hidden">
        <button aria-label="Fechar painel" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="absolute left-0 right-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#121212] p-5 shadow-2xl animate-in slide-in-from-bottom-5">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/10" />
          <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-4 mb-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-300 flex items-center gap-2">
              <Icon size={16} className="text-emerald-500" /> {title}
            </h2>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  };

  const renderScrapForm = () => (
    <form onSubmit={handleRegisterScrap} className="flex flex-col gap-5">
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block">DESCRICAO DO MATERIAL</label>
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
  );

  const renderSupplierForm = () => (
    <form onSubmit={handleAddSupplier} className="flex flex-col gap-5">
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wider">Nome da Empresa</label>
        <input type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Ex: Gerdau S.A." className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-gray-200 outline-none text-sm" required/>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wider">WhatsApp c/ DDD</label>
        <input type="text" value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} placeholder="Ex: 11999999999" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-gray-200 outline-none text-sm" required/>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wider">Material de Interesse</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsScrapDropdownOpen(!isScrapDropdownOpen)}
            className={`w-full bg-black/50 border ${isScrapDropdownOpen ? 'border-emerald-500/50' : 'border-white/10'} rounded-xl px-4 py-3 text-sm outline-none transition-all cursor-pointer flex justify-between items-center ${!newSupplierScrapCode ? 'text-gray-500' : 'text-gray-200'}`}
          >
            <span className="truncate">
              {newSupplierScrapCode ? scraps.find(s => s.code === newSupplierScrapCode)?.name : 'Selecione um material...'}
            </span>
            <ChevronDown size={16} className={`transition-transform ${isScrapDropdownOpen ? 'rotate-180 text-emerald-500' : 'text-gray-500'}`} />
          </button>

          {isScrapDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsScrapDropdownOpen(false)}></div>
              <div className="absolute top-full left-0 mt-2 w-full max-h-60 overflow-y-auto custom-scrollbar bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                {scraps.map(s => (
                  <button
                    type="button"
                    key={s.code}
                    onClick={() => {
                      setNewSupplierScrapCode(s.code);
                      setIsScrapDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-sm font-medium transition-colors cursor-pointer flex justify-between items-center ${newSupplierScrapCode === s.code ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-300 hover:bg-zinc-800/50'}`}
                  >
                    <span>{s.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono">#{s.code}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wider">Meta para Alerta (KG)</label>
        <div className="relative">
          <input type="number" step="0.1" value={newSupplierTargetKg} onChange={(e) => setNewSupplierTargetKg(e.target.value)} placeholder="Ex: 2000" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-gray-200 outline-none text-sm" required/>
          <span className="absolute right-4 top-[14px] text-gray-600 text-sm font-bold">KG</span>
        </div>
      </div>
      <button type="submit" className="w-full mt-2 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-gray-200 rounded-xl font-bold text-sm shadow-lg transition-all border border-white/10">Cadastrar Fornecedor</button>
    </form>
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-zinc-800/40 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative z-10 animate-in zoom-in-95">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4">
              <img src={scrapSysLogo} alt="ScrapSys" className="w-52 h-40 object-contain drop-shadow-2xl" />
            </div>
            <p className="text-sm text-gray-500 tracking-widest uppercase mt-1">Offline System</p>
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
    <div onClick={tapFeedback} className={`${isNativeMobile ? 'native-mobile ' : ''}app-safe-area min-h-screen bg-[#0a0a0a] text-gray-200 font-sans md:p-8 selection:bg-emerald-500/30 flex flex-col relative overflow-hidden`}>
      
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
        <div className="fixed left-4 right-4 bottom-[calc(7rem+env(safe-area-inset-bottom,0px))] md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-[100] bg-zinc-800 text-white px-6 py-4 rounded-xl shadow-2xl border border-white/10 animate-in slide-in-from-bottom-5 fade-in flex items-center justify-center md:justify-start gap-3 font-medium text-sm">
          <CheckCircle size={18} className="text-emerald-500" />
          {toast.message}
        </div>
      )}

      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-zinc-800/40 rounded-full blur-[120px] pointer-events-none"></div>

      <header className="flex justify-between items-center mb-6 md:mb-8 max-w-6xl mx-auto w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 shadow-xl z-10">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-black/40 border border-emerald-500/20 flex items-center justify-center overflow-hidden">
            <img src={scrapSysMark} alt="ScrapSys" className="w-12 h-12 object-contain" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white/90">ScrapSys</h1>
            <p className="text-[10px] text-emerald-500/70 font-mono tracking-widest">{currentUser.name}</p>
          </div>
        </div>

        <div className="mobile-bottom-nav flex bg-black/90 md:bg-black/40 backdrop-blur-xl rounded-3xl md:rounded-xl p-1.5 md:p-1 border border-white/10 md:border-white/5 gap-1 overflow-x-auto custom-scrollbar">
          {renderNavButton('home', 'Pesar', Home)}
          {renderNavButton('finance', 'Caixa', PieChart)}
          {renderNavButton('register', 'Sucata', PackagePlus)}
          {renderNavButton('suppliers', 'Fornec.', Truck)}
          {renderNavButton('settings', 'Ajustes', Settings)}

          <button onClick={() => setIsMoreMenuOpen(true)} title="Mais opcoes" className="min-w-[4rem] md:min-w-0 px-2 py-2.5 md:p-3 shrink-0 rounded-xl md:rounded-lg transition-all text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent flex flex-col md:flex-row items-center justify-center gap-1">
            <MoreHorizontal size={21} />
            <span className="text-[10px] font-black leading-none md:hidden">Mais</span>
          </button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto w-full mb-6 z-10">
        <div className="rounded-3xl border border-white/10 bg-[#121212]/70 backdrop-blur-xl p-4 md:p-5 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ActiveTabIcon size={21} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500 font-bold">Area atual</p>
              <h2 className="text-lg md:text-xl font-black text-white">{activeTabInfo.title}</h2>
              <p className="text-xs text-gray-500 mt-1">{activeTabInfo.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${cloudStatusClass}`}>{cloudStatusLabel}</span>
            <span className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-gray-400 text-[10px] font-black uppercase tracking-widest">v{appVersion}</span>
          </div>
        </div>
      </section>

      <MobileSheet open={isMoreMenuOpen} title="Mais opcoes" icon={MoreHorizontal} onClose={() => setIsMoreMenuOpen(false)}>
        <div className="grid grid-cols-1 gap-3">
          {currentUser.role === 'admin' && (
            <button onClick={() => { setActiveTab('users'); setIsMoreMenuOpen(false); }} className="w-full p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center gap-3 font-bold">
              <Shield size={20} /> Painel Admin
            </button>
          )}
          <button onClick={() => { setActiveTab('faq'); setIsMoreMenuOpen(false); }} className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-gray-300 flex items-center gap-3 font-bold">
            <Info size={20} /> Central de Ajuda
          </button>
          <button onClick={handleLogout} className="w-full p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-3 font-bold">
            <LogOut size={20} /> Sair do Sistema
          </button>
        </div>
      </MobileSheet>

      <MobileSheet open={isScrapFormOpen} title="Nova sucata" icon={PackagePlus} onClose={() => setIsScrapFormOpen(false)}>
        {renderScrapForm()}
      </MobileSheet>

      <MobileSheet open={isSupplierFormOpen} title="Novo fornecedor" icon={Truck} onClose={() => setIsSupplierFormOpen(false)}>
        {renderSupplierForm()}
      </MobileSheet>

      <main className="flex-1 w-full flex flex-col items-center z-10 pb-10">
        
        {/* ABA HOME */}
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
                    <div className="bg-black/40 rounded-2xl p-4 border border-white/5 relative">
                      {isNativeMobile ? (
                        <>
                          <label className="text-xs text-gray-500 mb-2 flex items-center gap-1.5 uppercase tracking-wider font-semibold"><PackagePlus size={14} /> Tipo de Sucata</label>
                          <button
                            type="button"
                            onClick={() => setIsMobileScrapDropdownOpen(!isMobileScrapDropdownOpen)}
                            className="w-full min-h-14 bg-zinc-900/70 border border-white/10 rounded-xl px-4 py-3 text-left flex items-center gap-3 focus:border-emerald-500/60 outline-none"
                          >
                            <span className="flex-1 min-w-0">
                              <span className={`block font-bold truncate ${selectedScrap ? 'text-white' : 'text-gray-600'}`}>{selectedScrap?.name || 'Selecione o material'}</span>
                              {selectedScrap && <span className="block text-xs text-emerald-500/80 mt-0.5">Cód. {selectedScrap.code} · {formatCurrency(selectedScrap.price)}/kg</span>}
                            </span>
                            <ChevronDown size={18} className={`text-gray-500 shrink-0 transition-transform ${isMobileScrapDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isMobileScrapDropdownOpen && (
                            <>
                              <button type="button" aria-label="Fechar lista de sucatas" className="fixed inset-0 z-40 cursor-default" onClick={() => setIsMobileScrapDropdownOpen(false)} />
                              <div className="absolute z-50 top-full left-0 right-0 mt-2 max-h-72 overflow-y-auto rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl p-2">
                                {scraps.map((scrap) => (
                                  <button
                                    type="button"
                                    key={scrap.code}
                                    onClick={() => handleSelectMobileScrap(scrap)}
                                    className={`w-full p-3 rounded-xl flex items-center gap-3 text-left transition-colors ${selectedScrap?.code === scrap.code ? 'bg-emerald-500/15 border border-emerald-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                                  >
                                    <span className="w-10 h-10 rounded-lg bg-black/40 text-emerald-400 font-mono text-xs flex items-center justify-center shrink-0">{scrap.code}</span>
                                    <span className="flex-1 min-w-0 font-semibold text-gray-200 truncate">{scrap.name}</span>
                                    <span className="text-xs font-bold text-emerald-400 shrink-0">{formatCurrency(scrap.price)}/kg</span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <label className="text-xs text-gray-500 mb-2 flex items-center gap-1.5 uppercase tracking-wider font-semibold"><Barcode size={14} /> Código / Leitor</label>
                          <input 
                            ref={codeInputRef} type="text" value={code} onChange={(e) => setCode(e.target.value)}
                            placeholder="Digite ou bipe..." className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-xl font-medium text-white placeholder-gray-700 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all" autoFocus
                          />
                        </>
                      )}
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

        {/* ABA FINANCEIRO */}
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
                      <EmptyState
                        icon={History}
                        title="Nenhuma compra ainda"
                        description="Quando uma pesagem for finalizada, ela aparece aqui com valor, usuario e data."
                        actionLabel="Ir para Pesagem"
                        onAction={() => setActiveTab('home')}
                      />
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

        {/* ABA CADASTRO DE MATERIAL */}
        {activeTab === 'register' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl w-full">
            <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 shadow-xl h-fit hidden lg:block">
              <h2 className="text-sm font-bold mb-6 flex items-center gap-2 text-gray-300 uppercase tracking-widest border-b border-white/5 pb-4"><Plus size={16} className="text-emerald-500" /> Nova Sucata</h2>
              {renderScrapForm()}
            </div>

            <div className="lg:col-span-2 bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 flex flex-col h-[600px] shadow-xl">
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                <h2 className="text-sm font-bold flex items-center gap-2 text-gray-300 uppercase tracking-widest"><Tag className="text-emerald-500" size={16} /> Tabela de Preços e Códigos</h2>
                <button onClick={() => setIsScrapFormOpen(true)} className="lg:hidden px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2">
                  <Plus size={14} /> Nova
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {scraps.length === 0 ? (
                  <EmptyState
                    icon={PackagePlus}
                    title="Nenhuma sucata cadastrada"
                    description="Cadastre os tipos de material para liberar selecao rapida na pesagem."
                    actionLabel="Cadastrar sucata"
                    onAction={() => setIsScrapFormOpen(true)}
                  />
                ) : (
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
                )}
              </div>
            </div>
          </div>
        )}

        {/* ABA FORNECEDORES */}
        {activeTab === 'suppliers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl w-full">
            <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 shadow-xl h-fit hidden lg:block">
              <h2 className="text-sm font-bold mb-6 flex items-center gap-2 text-gray-300 uppercase tracking-widest border-b border-white/5 pb-4"><Truck size={16} className="text-emerald-500" /> Novo Comprador</h2>
              {renderSupplierForm()}
            </div>

            <div className="lg:col-span-2 bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 flex flex-col h-[600px] shadow-xl">
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                <h2 className="text-sm font-bold flex items-center gap-2 text-gray-300 uppercase tracking-widest"><MessageCircle className="text-emerald-500" size={16} /> Controlo de Metas e Alertas</h2>
                <button onClick={() => setIsSupplierFormOpen(true)} className="lg:hidden px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2">
                  <Plus size={14} /> Novo
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {suppliers.length === 0 ? (
                  <EmptyState
                    icon={Truck}
                    title="Nenhum fornecedor ainda"
                    description="Cadastre compradores e metas para saber quando ja vale acionar coleta pelo WhatsApp."
                    actionLabel="Cadastrar fornecedor"
                    onAction={() => setIsSupplierFormOpen(true)}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {suppliers.map((s) => {
                      const inv = stats.inventoryMap[s.scrapCode];
                      const currentWeight = inv ? inv.weight : 0;
                      const progress = Math.min((currentWeight / s.targetKg) * 100, 100);
                      const isReady = currentWeight >= s.targetKg;

                      return (
                        <div key={s.id} className="bg-black/40 border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between group hover:bg-zinc-900/80 transition-all gap-4">
                          <div className="flex-1 w-full">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-bold text-gray-200 text-lg">{s.name}</p>
                                <p className="text-xs font-semibold text-gray-500 mt-0.5 uppercase tracking-widest flex items-center gap-1.5"><Truck size={12}/> {s.scrapName}</p>
                              </div>
                              <button onClick={() => handleDeleteSupplier(s.id)} className="p-2 text-red-500/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={16} /></button>
                            </div>
                            
                            <div className="mt-4">
                              <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">
                                <span>{currentWeight.toFixed(1)} KG em Estoque</span>
                                <span>Meta: {s.targetKg} KG</span>
                              </div>
                              <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-1000 ${isReady ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gray-500'}`} style={{ width: `${progress}%` }}></div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="sm:ml-4 w-full sm:w-auto shrink-0 border-t sm:border-t-0 sm:border-l border-white/5 pt-4 sm:pt-0 sm:pl-4 flex flex-col justify-center">
                            <button 
                              onClick={() => sendWhatsAppMessage(s, currentWeight)}
                              disabled={!isReady}
                              className={`w-full sm:w-32 py-3 rounded-xl font-bold text-xs transition-all flex flex-col items-center justify-center gap-1.5 border ${isReady ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/50 shadow-lg shadow-emerald-900/50' : 'bg-zinc-800 text-gray-500 border-white/5 opacity-50 cursor-not-allowed'}`}
                            >
                              <MessageCircle size={18} />
                              {isReady ? 'Avisar Coleta' : 'Aguardar'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ABA CONFIGURAÇÕES */}
        {activeTab === 'settings' && (
          <div className="flex flex-col max-w-5xl mx-auto w-full gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-rose-900 rounded-full mix-blend-multiply filter blur-[100px] opacity-10"></div>
              <h2 className="text-sm font-bold mb-6 flex items-center gap-2 text-gray-300 uppercase tracking-widest border-b border-white/5 pb-4"><Key size={16} className="text-gray-500" /> Alterar Senha de Acesso</h2>
              
              <form onSubmit={handleChangePassword} className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 mb-2 block uppercase tracking-widest">Senha Atual</label>
                  <input type="password" value={currentPasswordInput} onChange={e => setCurrentPasswordInput(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-gray-200 focus:ring-1 focus:ring-rose-500/50 outline-none transition-all text-sm" required />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 mb-2 block uppercase tracking-widest">Nova Senha</label>
                  <input type="password" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-gray-200 focus:ring-1 focus:ring-rose-500/50 outline-none transition-all text-sm" required minLength={10} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 mb-2 block uppercase tracking-widest">Confirmar Nova Senha</label>
                  <div className="flex gap-3">
                     <input type="password" value={confirmPasswordInput} onChange={e => setConfirmPasswordInput(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-gray-200 focus:ring-1 focus:ring-rose-500/50 outline-none transition-all text-sm" required minLength={10} />
                     <button type="submit" disabled={!currentPasswordInput || !newPasswordInput || !confirmPasswordInput} className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-gray-200 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-white/10"><CheckCircle size={16}/> Salvar</button>
                  </div>
                </div>
              </form>
            </div>

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
            
            <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-900 rounded-full mix-blend-multiply filter blur-[100px] opacity-10"></div>
              <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-gray-300 uppercase tracking-widest border-b border-white/5 pb-4"><Database size={16} className="text-emerald-500" /> Sincronização PC e Mobile</h2>
              <div className="relative z-10">
                <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-4 mb-5">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-200 font-bold">Cofre seguro ScrapSys</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">A nuvem agora usa uma conta dona do Firebase. Isso evita sessoes anonimas ilimitadas e reduz risco de leitura, escrita ou abuso por usuarios externos.</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border w-fit ${cloudSyncStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : cloudSyncStatus === 'offline' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-white/5 text-gray-500 border-white/10'}`}>
                      {cloudSyncStatus === 'connected' ? 'Conectado' : cloudSyncStatus === 'connecting' ? 'Conectando' : cloudSyncStatus === 'offline' ? 'Offline' : 'Desativado'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">
                        Workspace: <span className="text-emerald-400 font-semibold">shared_workspace</span>
                        {cloudSyncUser?.uid && <span className="text-gray-600"> / UID {cloudSyncUser.uid}</span>}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-wider">
                        {cloudSyncUser?.email ? `Conta conectada: ${cloudSyncUser.email}` : 'Conecte a conta dona uma vez neste dispositivo.'}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-wider">
                        {cloudLastSync ? `Ultima sincronizacao: ${cloudLastSync.toLocaleTimeString('pt-BR')}` : 'A sincronizacao automatica inicia apos conectar o cofre.'}
                      </p>
                    </div>
                    {cloudSyncUser ? (
                      <div className="flex gap-2">
                        <button onClick={handleRunCloudSyncNow} disabled={isSyncingData} className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm disabled:opacity-50">
                          Sincronizar agora
                        </button>
                        <button onClick={handleDisconnectCloudSync} disabled={isSyncingData} className="px-4 py-3 bg-white/5 text-gray-400 border border-white/10 rounded-xl font-bold text-sm disabled:opacity-50">
                          Sair da nuvem
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 w-full sm:w-auto">
                        <input type="email" value={cloudSyncEmail} onChange={(e) => setCloudSyncEmail(e.target.value)} placeholder="E-mail Firebase dono" className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 text-sm" />
                        <input type="password" value={cloudSyncPassword} onChange={(e) => setCloudSyncPassword(e.target.value)} placeholder="Senha" className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 text-sm" />
                        <button onClick={handleConnectCloudSync} disabled={isSyncingData || !cloudSyncEmail || !cloudSyncPassword} className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm disabled:opacity-50">
                          Conectar
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-4 leading-relaxed">Depois de conectado, o login interno do ScrapSys continua valendo normalmente. Quando o admin cria um usuario comum, ele fica disponivel no PC e no Android apos a sincronizacao segura.</p>
                </div>

                <p className="text-sm text-gray-300 font-semibold">Rede local gratuita como alternativa</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">Use quando quiser sincronizar sem internet, mantendo o PC aberto e os dispositivos no mesmo Wi-Fi.</p>

                {isNativeMobile ? (
                  <div className="mt-5 space-y-3">
                    <input
                      value={automaticSync.serverUrl}
                      onChange={(event) => setAutomaticSync({ ...automaticSync, enabled: false, serverUrl: event.target.value })}
                      placeholder="Endereço exibido no PC"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50"
                    />
                    <input
                      value={automaticSync.pairingCode}
                      onChange={(event) => setAutomaticSync({ ...automaticSync, enabled: false, pairingCode: event.target.value.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 32) })}
                      inputMode="text"
                      placeholder="Codigo seguro de pareamento"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white tracking-[0.3em] outline-none focus:border-emerald-500/50"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleEnableAutomaticSync}
                        disabled={isSyncingData}
                        className="flex-1 px-5 py-3.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-sm disabled:opacity-50"
                      >
                        {automaticSyncStatus === 'connecting' ? 'Conectando...' : 'Conectar automaticamente'}
                      </button>
                      {automaticSync.enabled && (
                        <button onClick={handleDisableAutomaticSync} className="px-4 py-3.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold text-sm">Desativar</button>
                      )}
                    </div>
                    <p className={`text-xs font-semibold ${automaticSyncStatus === 'connected' ? 'text-emerald-400' : automaticSyncStatus === 'offline' ? 'text-amber-400' : 'text-gray-500'}`}>
                      {automaticSyncStatus === 'connected' ? 'Conectado ao PC e sincronizando.' : automaticSyncStatus === 'offline' ? 'PC indisponível. Tentaremos novamente automaticamente.' : 'Aguardando pareamento.'}
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl bg-black/40 border border-white/10 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Endereço deste PC</p>
                    {(syncServerInfo?.addresses || []).map((address) => (
                      <p key={address} className="mt-2 text-sm font-mono text-emerald-400 break-all">{address}</p>
                    ))}
                    {!syncServerInfo?.addresses?.length && <p className="mt-2 text-sm text-amber-400">Conecte o PC a uma rede Wi-Fi ou cabo.</p>}
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-4">Código de pareamento</p>
                    <p className="mt-1 text-2xl font-black tracking-[0.35em] text-white">{syncServerInfo?.pairingCode || '------'}</p>
                  </div>
                )}

                <p className="text-[10px] text-gray-600 mt-6 uppercase tracking-wider">Backup manual de segurança</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <button
                    onClick={handleExportBackup}
                    disabled={isSyncingData}
                    className="px-5 py-3.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-sm hover:bg-emerald-500/20 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                  >
                    <Download size={17} /> Exportar sincronização
                  </button>
                  <button
                    onClick={() => backupInputRef.current?.click()}
                    disabled={isSyncingData}
                    className="px-5 py-3.5 bg-white/5 text-gray-300 border border-white/10 rounded-xl font-bold text-sm hover:bg-white/10 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                  >
                    <Upload size={17} /> Importar sincronização
                  </button>
                  <input
                    ref={backupInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </div>
                <p className="text-[10px] text-amber-500/70 mt-4 uppercase tracking-wider">O arquivo contém dados de acesso. Guarde-o em local privado.</p>
              </div>
            </div>

            <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-900 rounded-full mix-blend-multiply filter blur-[100px] opacity-10"></div>
              <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-gray-300 uppercase tracking-widest border-b border-white/5 pb-4"><RefreshCw size={16} className="text-gray-500" /> Atualizações do Sistema</h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between relative z-10 gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-gray-200">{isNativeMobile ? 'Atualizações do Android' : 'Verificar Novas Versões'}</p>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold tracking-widest border border-blue-500/20">v{appVersion}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{isNativeMobile ? 'Novas versões devem ser instaladas pela Play Store ou usando um APK assinado mais recente.' : 'Sincronize com o servidor para garantir que possui a última versão do ScrapSys instalada.'}</p>
                </div>
                <button
                  onClick={handleCheckForUpdates}
                  disabled={isCheckingUpdate}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl font-bold text-sm hover:bg-blue-500/20 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                >
                  {isCheckingUpdate ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                  {isCheckingUpdate ? 'A procurar...' : (isNativeMobile ? 'Como atualizar' : 'Procurar Atualizações')}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ABA PAINEL ADMIN */}
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
                            {u.id !== 'admin_root' && (
                              <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all border border-transparent hover:border-red-500/20"><Trash2 size={16} /></button>
                            )}
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

        {/* ABA FAQ */}
        {activeTab === 'faq' && (
          <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 shadow-xl relative overflow-hidden">
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-900 rounded-full mix-blend-multiply filter blur-[100px] opacity-10"></div>
              
              <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-500">
                  <Info size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-200">Central de Ajuda</h2>
                  <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">Perguntas Frequentes e Suporte</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-black/40 border border-white/5 rounded-2xl p-5 hover:bg-zinc-900/50 transition-colors">
                  <h3 className="font-bold text-gray-200 mb-2 flex items-center gap-2"><Scale size={16} className="text-emerald-500"/> Como conecto a balança ao sistema?</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">Vá até à aba <strong>Configurações</strong> e procure a secção "Gestão de Balanças". Selecione o tipo de ligação (Bluetooth, USB ou Rede IP) e clique em "Buscar Dispositivo". Após o sistema detetar, clique em "Salvar".</p>
                </div>
                
                <div className="bg-black/40 border border-white/5 rounded-2xl p-5 hover:bg-zinc-900/50 transition-colors">
                  <h3 className="font-bold text-gray-200 mb-2 flex items-center gap-2"><Wallet size={16} className="text-emerald-500"/> Onde posso fazer Suprimento ou Sangria do Caixa?</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">Aceda à aba <strong>Financeiro</strong>. No primeiro quadro verde (Caixa Atual Disponível), existe um ícone de lápis no canto superior direito. Ao clicar, o sistema abrirá um painel seguro para Adicionar (Suprimento) ou Retirar (Sangria) valores do seu caixa diário.</p>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-2xl p-5 hover:bg-zinc-900/50 transition-colors">
                  <h3 className="font-bold text-gray-200 mb-2 flex items-center gap-2"><Truck size={16} className="text-emerald-500"/> Como funcionam os alertas de WhatsApp?</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">Na aba <strong>Fornecedores</strong>, pode cadastrar os compradores finais e o peso-meta que eles compram de cada material (Ex: 2.000kg de Cobre). O sistema monitoriza o seu inventário na aba Financeiro e, assim que esse peso for atingido, o botão "Avisar Coleta" ficará verde, pronto a enviar a notificação no WhatsApp.</p>
                </div>

                <div className="bg-black/40 border border-white/5 rounded-2xl p-5 hover:bg-zinc-900/50 transition-colors">
                  <h3 className="font-bold text-gray-200 mb-2 flex items-center gap-2"><Download size={16} className="text-emerald-500"/> O sistema funciona sem Internet?</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">Sim! O ScrapSys é 100% offline. Todos os seus dados, clientes e transações ficam gravados fisicamente e com segurança no seu computador. A Internet é solicitada apenas se desejar clicar no botão "Procurar Atualizações" para instalar novas funcionalidades ou gerar o alerta de WhatsApp Web.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* MODAIS (Renovar Licença, Caixa, Preview Etiqueta, Cupom) */}
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
              <button onClick={printReceipt} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-xl hover:bg-emerald-50 transition-colors"><Printer size={18} /> Imprimir</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        /* Ocultar barra de rolagem no Chrome/Safari/Edge */
        ::-webkit-scrollbar {
          width: 0px;
          background: transparent;
          display: none;
        }
        /* Ocultar barra de rolagem no Firefox e IE */
        * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
      `}} />
    </div>
  );
}
