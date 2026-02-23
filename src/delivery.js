const DUI = {
    currentDgId: 1, // Logic to pull from Telegram InitData or Session
    lastOrderCount: 0,
    isFirstLoad: true,

    async init() {
        try {
            await Promise.all([
                this.loadProfile(),
                this.loadOrders(),
                this.loadStats()
            ]);
            
            // Start tactical polling for new orders every 10 seconds
            setInterval(() => this.loadOrders(), 10000);
            
            console.log("Rider Terminal: Online & Polling.");
        } catch (err) {
            console.error("Uplink Failed:", err);
        }
    },

    async loadProfile() {
        try {
            const res = await fetch(`/api/delivery/settings?delivery_guy_id=${this.currentDgId}`);
            const data = await res.json();
            if (data.status === "ok" && data.settings) {
                const s = data.settings;
                document.getElementById('dgName').innerText = `${s.name} @ ${s.campus}`;
                
                const profileWrap = document.getElementById('profileDetails');
                if (profileWrap) {
                    profileWrap.innerHTML = `
                        <div class="flex items-center gap-6 mb-8 border-b border-white/5 pb-8">
                            <div class="w-20 h-20 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                                <i class="fa-solid fa-user-astronaut text-3xl text-orange-500"></i>
                            </div>
                            <div>
                                <h2 class="text-3xl font-black italic uppercase text-white leading-none">${s.name}</h2>
                                <p class="mono text-[10px] text-orange-500 uppercase mt-2 tracking-[0.2em]">${s.campus} Sector</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 gap-4">
                            <div class="p-5 rounded-[2rem] bg-white/5 border border-white/5">
                                <span class="mono text-[9px] text-slate-500 uppercase tracking-widest">Comm_Link</span>
                                <p class="text-sm font-bold mt-1 text-slate-200">${s.phone}</p>
                            </div>
                            <div class="p-5 rounded-[2rem] bg-white/5 border border-white/5 flex justify-between items-center">
                                <div>
                                    <span class="mono text-[9px] text-slate-500 uppercase tracking-widest">Duty_Status</span>
                                    <p class="text-sm font-bold mt-1 text-slate-200">${s.active ? 'ACTIVE' : 'OFFLINE'}</p>
                                </div>
                                <div class="w-3 h-3 rounded-full ${s.active ? 'bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}"></div>
                            </div>
                        </div>
                    `;
                }
            }
        } catch (e) { console.error("Profile Load Error:", e); }
    },

    async loadOrders() {
        try {
            const res = await fetch(`/api/delivery/my_orders?delivery_guy_id=${this.currentDgId}`);
            const data = await res.json();
            const orders = data.orders || [];

            // ALERT LOGIC: If new orders arrived since last poll
            if (!this.isFirstLoad && orders.length > this.lastOrderCount) {
                this.triggerNewOrderAlert();
            }
            this.lastOrderCount = orders.length;
            this.isFirstLoad = false;

            const list = document.getElementById('ordersList');
            if (!list) return;

            list.innerHTML = orders.map(o => `
                <div class="glass-ui rounded-[2.5rem] p-2 group transition-all hover:translate-y-[-4px]">
                    <div class="bg-slate-900/40 rounded-[2.3rem] p-6 border border-white/5 flex flex-col h-full group-hover:bg-slate-900/60 transition-all">
                        <div class="flex justify-between items-start mb-6">
                            <div>
                                <span class="text-[9px] mono text-orange-500 font-black tracking-[0.2em] uppercase">SCAN_ID: #${o.id}</span>
                                <div class="flex items-baseline gap-2 mt-2">
                                    <h3 class="text-3xl font-black italic text-white uppercase leading-none">${o.total_price - o.upfront_paid}</h3>
                                    <span class="text-[10px] mono text-slate-500 font-bold uppercase tracking-widest">To Collect</span>
                                </div>
                            </div>
                            <div class="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                <i class="fa-solid fa-box text-slate-500 group-hover:text-orange-500 transition-colors"></i>
                            </div>
                        </div>
                        <div class="space-y-3 mb-6 flex-1">
                            <div class="flex justify-between text-[10px] mono">
                                <span class="text-slate-500 uppercase tracking-widest">Timestamp:</span>
                                <span class="text-slate-300 uppercase">${new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div class="flex justify-between text-[10px] mono">
                                <span class="text-slate-500 uppercase tracking-widest">Base_Fee:</span>
                                <span class="text-emerald-500 font-bold">+ ${o.delivery_fee} ETB</span>
                            </div>
                        </div>
                        <button onclick="DUI.completeOrder(${o.id})" class="w-full py-4 bg-white text-black text-[11px] font-black mono rounded-2xl uppercase tracking-[0.1em] hover:bg-orange-500 hover:text-white transition-all shadow-xl shadow-white/5">
                            Mark Delivered
                        </button>
                    </div>
                </div>
            `).join('') || `
                <div class="col-span-full text-center py-20">
                    <div class="inline-flex w-16 h-16 rounded-full bg-white/5 items-center justify-center mb-4">
                        <i class="fa-solid fa-satellite-dish text-slate-700 animate-pulse"></i>
                    </div>
                    <p class="mono text-slate-600 uppercase tracking-widest text-[10px]">Scanning for available drops...</p>
                </div>
            `;
        } catch (e) { console.error("Order Load Error:", e); }
    },

    triggerNewOrderAlert() {
        // 1. Audio Ping
        const audio = document.getElementById('notifSound');
        if (audio) audio.play().catch(() => console.log("Audio awaiting user interaction"));

        // 2. Visual Badge on Bottom Nav
        const badge = document.getElementById('orderBadge');
        if (badge) badge.classList.remove('hidden');

        // 3. Telegram Haptics
        if (window.Telegram?.WebApp?.HapticFeedback) {
            Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
        }
    },

    switchView(view) {
        const views = ['orders', 'stats', 'profile'];
        views.forEach(v => {
            const viewEl = document.getElementById(`view-${v}`);
            const btn = document.getElementById(`tab-${v}`);
            if (viewEl) viewEl.classList.toggle('hidden', v !== view);
            
            if (btn) {
                const indicator = btn.querySelector('.active-indicator');
                if (v === view) {
                    btn.className = "nav-item flex-1 py-3 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-1 mono text-[10px] font-black uppercase tracking-widest bg-orange-500 text-black shadow-[0_0_20px_rgba(249,115,22,0.3)] scale-105 z-10";
                    if (indicator) indicator.className = "active-indicator absolute -bottom-1 w-4 h-1 bg-black rounded-full transition-all duration-500 opacity-100";
                    
                    // Clear badge if opening orders
                    if (v === 'orders') {
                        const badge = document.getElementById('orderBadge');
                        if (badge) badge.classList.add('hidden');
                    }
                } else {
                    btn.className = "nav-item flex-1 py-3 rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-1 mono text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 hover:bg-white/5";
                    if (indicator) indicator.className = "active-indicator absolute -bottom-1 w-1 h-1 bg-orange-500 rounded-full transition-all duration-500 opacity-0";
                }
            }
        });

        if (window.Telegram?.WebApp?.HapticFeedback) {
            Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }
    },

    async completeOrder(id) {
        if (!confirm("Confirm successful delivery and collection?")) return;
        const res = await fetch('/api/delivery/update_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: id, status: 'delivered', delivery_guy_id: this.currentDgId })
        });
        if (res.ok) { this.loadOrders(); this.loadStats(); }
    },

    async loadStats() {
        const res = await fetch(`/api/delivery/my_stats?delivery_guy_id=${this.currentDgId}`);
        const { stats } = await res.json();
        const container = document.getElementById('statsContainer');
        if (!container || !stats) return;

        const metrics = [
            { label: 'Drops Made', val: stats.total_deliveries || 0, color: 'text-white' },
            { label: 'System Level', val: `LVL ${stats.level || 1}`, color: 'text-orange-500' },
            { label: 'UniCoins', val: stats.coins || 0, color: 'text-emerald-400' },
            { label: 'Total XP', val: stats.xp || 0, color: 'text-blue-400' }
        ];

        container.innerHTML = metrics.map(m => `
            <div class="glass-ui p-6 rounded-[2rem] border border-white/5 transition-all hover:border-white/20">
                <p class="text-[9px] mono text-slate-500 uppercase mb-2 tracking-tighter">${m.label}</p>
                <h3 class="text-2xl font-black italic ${m.color} tracking-tighter">${m.val}</h3>
            </div>
        `).join('');
    }
};

DUI.init();