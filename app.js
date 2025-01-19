class SteamGuardApp {
    constructor() {
        this.accounts = [];
        this.key = null;
        this.lastActivityTime = Date.now();
        this.DEFAULT_INACTIVITY_TIMEOUT = 1 * 60 * 1000;
        this.setupEventListeners();
        this.checkInitialState();
        this.startInactivityCheck();
    }

    setupEventListeners() {
        document.getElementById('password-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePasswordSubmit();
        });

        document.getElementById('create-password-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreatePassword();
        });

        document.getElementById('maFile').addEventListener('change', (e) => {
            this.handleFileUpload(e.target);
        });

        document.getElementById('add-account').addEventListener('click', () => {
            document.getElementById('add-maFile').click();
        });

        document.getElementById('add-maFile').addEventListener('change', (e) => {
            this.handleFileUpload(e.target);
        });

        document.getElementById('reset-button').addEventListener('click', () => {
            if (confirm('Вы уверены? Все сохраненные аккаунты будут удалены.')) {
                this.resetApp();
            }
        });

        const updateLastActivity = () => {
            if (this.key) {
                this.lastActivityTime = Date.now();
            }
        };

        ['click', 'keypress', 'mousemove', 'touchstart'].forEach(eventType => {
            document.addEventListener(eventType, updateLastActivity);
        });
    }

    async checkInitialState() {
        const encrypted = localStorage.getItem('accounts');
        const passwordForm = document.getElementById('password-form');
        const createPasswordForm = document.getElementById('create-password-form');

        if (encrypted) {
            passwordForm.classList.remove('hidden');
            createPasswordForm.classList.add('hidden');
        } else {
            passwordForm.classList.add('hidden');
            createPasswordForm.classList.remove('hidden');
        }
    }

    async handleCreatePassword() {
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            this.showToast('Пароли не совпадают', 'error');
            return;
        }

        this.key = await SteamGuardCrypto.deriveKey(newPassword);
        document.getElementById('create-password-form').classList.add('hidden');
        document.getElementById('file-upload').classList.remove('hidden');
    }

    async handlePasswordSubmit() {
        const password = document.getElementById('password').value;
        this.key = await SteamGuardCrypto.deriveKey(password);

        const encrypted = localStorage.getItem('accounts');
        if (encrypted) {
            try {
                this.accounts = await SteamGuardCrypto.decrypt(JSON.parse(encrypted), this.key);
                this.showCodesScreen();
            } catch (error) {
                this.showToast('Неверный пароль', 'error');
            }
        }
    }

    resetApp() {
        localStorage.removeItem('accounts');
        this.accounts = [];
        this.key = null;
        document.getElementById('codes-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('password-form').classList.add('hidden');
        document.getElementById('create-password-form').classList.remove('hidden');
        document.getElementById('file-upload').classList.add('hidden');
        document.getElementById('password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
    }

    async handleFileUpload(fileInput) {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const maFile = JSON.parse(e.target.result);
                
                if (!maFile.account_name || !maFile.shared_secret || !maFile.Session?.SteamID) {
                    throw new Error('Некорректный формат файла');
                }

                if (this.accounts.some(acc => acc.steam_id === maFile.Session?.SteamID)) {
                    alert('Этот аккаунт уже добавлен');
                    fileInput.value = '';
                    return;
                }

                this.accounts.push({
                    account_name: maFile.account_name,
                    shared_secret: maFile.shared_secret,
                    steam_id: maFile.Session?.SteamID || ''
                });

                const encrypted = await SteamGuardCrypto.encrypt(this.accounts, this.key);
                localStorage.setItem('accounts', JSON.stringify(encrypted));

                this.showCodesScreen();
            } catch (error) {
                alert(error.message || 'Ошибка при чтении файла');
            } finally {
                fileInput.value = '';
            }
        };
        reader.readAsText(file);
    }

    showCodesScreen() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('codes-screen').classList.remove('hidden');
        this.updateCodes();
        this.lastActivityTime = Date.now();
    }

    showToast(message, type = 'success', duration = 2000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;

        const container = document.getElementById('toast-container');
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add(type);
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });
        });

        const hideTimeout = setTimeout(() => {
            toast.classList.add('hide');
            
            toast.addEventListener('transitionend', (e) => {
                if (e.propertyName === 'opacity' && container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, { once: true });
        }, duration);

        toast._hideTimeout = hideTimeout;

        return toast;
    }

    async updateCodes() {
        const accountsList = document.getElementById('accounts-list');
        
        if (accountsList.children.length !== this.accounts.length) {
            accountsList.innerHTML = '';
            
            for (const account of this.accounts) {
                const accountElement = document.createElement('div');
                accountElement.className = 'account-item';
                accountElement.innerHTML = `
                    <div class="account-info">
                        <div class="account-header">
                            <span class="account-name">${account.account_name}</span>
                            ${account.steam_id ? `<span class="steam-id">${account.steam_id}</span>` : ''}
                        </div>
                        <div class="code" data-account="${account.account_name}"></div>
                    </div>
                    <svg class="timer" viewBox="0 0 36 36">
                        <path d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#66c0f4"
                            stroke-width="3"
                        />
                    </svg>
                `;

                accountElement.addEventListener('click', () => {
                    const code = accountElement.querySelector('.code').textContent;
                    navigator.clipboard.writeText(code);
                    accountElement.classList.add('copied');
                    setTimeout(() => accountElement.classList.remove('copied'), 200);
                    this.showToast('Код скопирован', 'success');
                });

                accountsList.appendChild(accountElement);
            }
        }

        for (const account of this.accounts) {
            const code = await SteamGuardCrypto.generateSteamGuardCode(account.shared_secret);
            const timeRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
            
            const codeElement = accountsList.querySelector(`[data-account="${account.account_name}"]`);
            const timerElement = codeElement.parentElement.parentElement.querySelector('.timer path');
            
            if (codeElement.textContent !== code) {
                codeElement.textContent = code;
            }
            
            timerElement.setAttribute('stroke-dasharray', `${(timeRemaining / 30) * 100}, 100`);
        }
    }

    lockApp() {
        this.showToast('Сессия завершена из-за неактивности', 'warning', 3000);
        
        this.key = null;
        document.getElementById('password').value = '';
        
        document.getElementById('codes-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('password-form').classList.remove('hidden');
        document.getElementById('create-password-form').classList.add('hidden');
        document.getElementById('file-upload').classList.add('hidden');
    }

    startInactivityCheck() {
        setInterval(() => {
            if (this.key && Date.now() - this.lastActivityTime >= this.DEFAULT_INACTIVITY_TIMEOUT) {
                this.lockApp();
            }
        }, 10000);
    }
}

const app = new SteamGuardApp();
setInterval(() => app.updateCodes(), 1000);