
const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:8000/api"
    : "https://deliveraau.onrender.com";
let missionInterval = null; // Add this at the very top of your file
const userId = localStorage.getItem("ub_user_id");
console.log('here is the userId from localStorage:', userId);
if (userId) {
  fetch(`${API_BASE}/auth/delivery_guy_id?telegram_id=${userId}`)
    .then(res => res.json())
    .then(data => {
      if (data.status === "ok") {
        DUI.currentDgId = data.delivery_guy_id;
        console.log("Resolved delivery guy ID:", DUI.currentDgId);
        DUI.init(); // now safe to load orders/stats
      } else {
        console.error("Delivery guy lookup failed:", data.message);
      }
    })
    .catch(err => console.error("Lookup API error:", err));
}

const DUI = {
    lastOrderCount: 0,
    currentDgId: 1, // Global variable to store the delivery guy ID after lookup

    isFirstLoad: true,

    async init() {

        if (!this.currentDgId) {
            console.error("Terminal Error: No Agent ID resolved.");
            return;
        }
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
        const res = await fetch(`${API_BASE}/api/delivery/settings?delivery_guy_id=${this.currentDgId}`);
        const data = await res.json();
        if (data.status === "ok" && data.settings) {
            const s = data.settings;
            document.getElementById('dgName').innerText = `${s.name} // ${s.campus}`;
            
            const profileWrap = document.getElementById('profileDetails');
            profileWrap.innerHTML = `
                <div class="glass-ui rounded-[2.5rem] p-1.5 border border-white/5 mb-6">
                    <div class="bg-gradient-to-br from-slate-900 to-slate-950 rounded-[2.3rem] p-8">
                        <div class="flex flex-col items-center text-center">
                            <div class="relative mb-6">
                                <div class="w-24 h-24 rounded-full border-2 border-dashed border-orange-500/50 p-2 animate-[spin_10s_linear_infinite]"></div>
                                <div class="absolute inset-0 flex items-center justify-center">
                                    <div class="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center text-black shadow-[0_0_30px_rgba(249,115,22,0.4)]">
                                        <i class="fa-solid fa-user-tie text-2xl"></i>
                                    </div>
                                </div>
                            </div>
                            <h2 class="text-3xl font-black italic uppercase text-white tracking-tighter">${s.name}</h2>
                            <p class="mono text-[10px] text-orange-500 uppercase tracking-[0.4em] mt-2">Certified_DeliveryGuy</p>
                        </div>

                        <div class="grid grid-cols-1 gap-3 mt-10">
                            <div class="flex justify-between items-center p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                <span class="mono text-[9px] text-slate-500 uppercase">Sector</span>
                                <span class="text-xs font-bold text-white uppercase">${s.campus}</span>
                            </div>
                            <div class="flex justify-between items-center p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                <span class="mono text-[9px] text-slate-500 uppercase">Comms_ID</span>
                                <span class="text-xs font-bold text-white">${s.phone}</span>
                            </div>
                            <div class="flex justify-between items-center p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                <span class="mono text-[9px] text-slate-500 uppercase">Duty_Protocol</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-[9px] font-black ${s.active ? 'text-green-500' : 'text-red-500'} uppercase">${s.active ? 'Online' : 'Offline'}</span>
                                    <div class="w-2 h-2 rounded-full ${s.active ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button onclick="DUI.logout()" class="w-full py-4 rounded-2xl border border-red-500/20 text-red-500 mono text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all">
                    Disconnect_Terminal
                </button>
            `;
        }
    } catch (e) { console.error("Profile Load Error:", e); }
},

    async loadOrders() {
    try {
        const res = await fetch(`${API_BASE}/api/delivery/my_orders?delivery_guy_id=${this.currentDgId}`);
        const data = await res.json();
        const orders = data.orders || [];

        if (!this.isFirstLoad && orders.length > this.lastOrderCount) {
            this.triggerNewOrderAlert();
        }
        this.lastOrderCount = orders.length;
        this.isFirstLoad = false;

        const list = document.getElementById('ordersList');
        if (!list) return;

     list.innerHTML = orders.map(o => {
    const amountToCollect = o.total_price - o.upfront_paid;
    
    return `
    <div class="glass-ui rounded-[2.5rem] p-1.5 border border-white/5 overflow-hidden active:scale-[0.98] transition-all duration-300 cursor-pointer" 
         onclick="DUI.openMissionDetail(${o.id})">
        <div class="bg-white/[0.02] rounded-[2.3rem] p-6 relative">
            <div class="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/5 blur-3xl rounded-full"></div>
            
            <div class="flex justify-between items-start mb-6 relative z-10">
                <div>
                    <p class="mono text-[8px] text-orange-500 font-black tracking-widest uppercase">Target_ID: #UB-${o.id}</p>
                    <h3 class="text-4xl font-black italic text-white mt-1">
                        ${amountToCollect.toLocaleString()} 
                        <span class="text-xs not-italic text-slate-500 mono uppercase tracking-normal">ETB</span>
                    </h3>
                    <p class="text-[9px] mono text-slate-500 uppercase mt-1 tracking-widest">Collection Amount</p>
                </div>
                <div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner group-hover:border-orange-500/50 transition-all">
                    <i class="fa-solid fa-crosshairs text-orange-500"></i>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-6 relative z-10">
                <div class="bg-black/40 p-3 rounded-2xl border border-white/5">
                    <p class="text-[9px] mono text-slate-500 uppercase mb-1">Received</p>
                    <p class="text-[10px] font-bold text-slate-300 uppercase">${new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
                <div class="bg-black/40 p-3 rounded-2xl border border-white/5 text-right">
                    <p class="text-[9px] mono text-slate-500 uppercase mb-1">Delivery Fee</p>
                    <p class="text-[10px] font-bold text-emerald-500 font-mono tracking-tighter">+${o.delivery_fee} ETB</p>
                </div>
            </div>

            <button onclick="event.stopPropagation(); DUI.completeOrder(${o.id})" 
                    class="w-full py-4 bg-white text-black text-[10px] font-black mono rounded-2xl uppercase tracking-[0.2em] shadow-xl hover:bg-orange-500 hover:text-white transition-all active:scale-95 relative z-10">
                Finish Mission
            </button>
        </div>
    </div>`;
}).join('') || `...`; // Keep your existing empty state
    } catch (e) { console.error("Order Load Error:", e); }
},

    async loadStats() {
    // 1. SELECT ALL CONTAINERS
    const globalContainer = document.getElementById('statsContainer');
    const foodGrid = document.getElementById('food-stats-grid');
    const asbezaGrid = document.getElementById('asbeza-stats-grid');

    // 2. SHOW SHIMMERS IMMEDIATELY FOR DEEP STATS
    const skeleton = `<div class="glass-ui p-6 rounded-[2.5rem] border border-white/5 h-28 skeleton"></div>`.repeat(4);
    foodGrid.innerHTML = skeleton;
    asbezaGrid.innerHTML = skeleton;

    try {
        // 3. FETCH GLOBAL STATS (Level, XP, etc)
        const globalRes = await fetch(`${API_BASE}/api/delivery/my_stats?delivery_guy_id=${this.currentDgId}`);
        const { stats } = await globalRes.json();
        
        if (stats && globalContainer) {
            const metrics = [
                { label: 'Total_Drops', val: stats.total_deliveries || 0, icon: 'fa-box-check', color: 'text-white' },
                { label: 'Rank_Level', val: stats.level || 1, icon: 'fa-microchip', color: 'text-orange-500' },
                { label: 'UniCoins', val: stats.coins || 0, icon: 'fa-coins', color: 'text-yellow-500' },
                { label: 'Total_XP', val: stats.xp || 0, icon: 'fa-dna', color: 'text-blue-400' }
            ];

            globalContainer.innerHTML = metrics.map(m => `
                <div class="glass-ui p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden group active:scale-95 transition-transform">
                    <div class="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                        <i class="fa-solid ${m.icon} text-6xl"></i>
                    </div>
                    <p class="text-[8px] mono text-slate-500 uppercase mb-3 tracking-widest relative z-10">${m.label}</p>
                    <div class="flex items-baseline gap-2 relative z-10">
                        <h3 class="text-3xl font-black italic ${m.color} tracking-tighter">${m.val}</h3>
                    </div>
                    <div class="mt-4 w-full h-1 bg-white/5 rounded-full overflow-hidden relative z-10">
                        <div class="h-full bg-orange-500/50 rounded-full" style="width: 65%"></div>
                    </div>
                </div>
            `).join('');
        }

        // 4. FETCH DEEP STATS IN PARALLEL
        const [foodRes, asbezaRes] = await Promise.all([
            fetch(`${API_BASE}/api/delivery/food_stats?delivery_guy_id=${this.currentDgId}`),
            fetch(`${API_BASE}/api/delivery/asbeza_stats?delivery_guy_id=${this.currentDgId}`)
        ]);

        const foodData = await foodRes.json();
        const asbezaData = await asbezaRes.json();

        // 5. RENDER DEEP STATS (W/ SUCCESS ANIMATION)
        if (foodData.status === "ok") {
            const s = foodData.stats;
            foodGrid.innerHTML = `
                ${this.buildMiniCard("Deliveries", s.total_orders, "fa-moped", "text-white")}
                ${this.buildMiniCard("Fees_Earned", `${s.total_delivery_fees} ETB`, "fa-wallet", "text-emerald-500")}
                ${this.buildMiniCard("Total_Flow", `${s.total_earnings} ETB`, "fa-chart-line", "text-white")}
            `;
        }

        if (asbezaData.status === "ok") {
            const s = asbezaData.stats;
            asbezaGrid.innerHTML = `
               ${this.buildMiniCard("Deliveries", s.total_orders || 0, "fa-box", "text-white")}
${this.buildMiniCard("Fees_Earned", `${s.total_delivery_fees || 0} ETB`, "fa-wallet", "text-orange-500")}
${this.buildMiniCard("Asbeza_Value", `${s.total_order_value || 0} ETB`, "fa-shop", "text-slate-400")}
${this.buildMiniCard("Total_Flow", `${s.total_earnings || 0} ETB`, "fa-bolt", "text-white")}

            `;
        }

    } catch (e) { console.error("Performance Link Broken", e); }
},

    triggerNewOrderAlert() {
        // 1. Audio Ping
        const audio = document.getElementById('notifSound');
        if (audio) audio.play().catch(() => console.log("Audio awaiting user interaction"));

        // 2. Visual Badge on Bottom Nav
        const badge = document.getElementById('orderBadge');
        if (badge) badge.classList.remove('hidden');

      
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

    },

    async completeOrder(id) {
        if (!confirm("Confirm successful delivery and collection?")) return;
            const res = await fetch(`${API_BASE}/api/delivery/update_status_delivery`, { // <-- match backend route            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: id, status: 'delivered', delivery_guy_id: this.currentDgId })
        });
        if (res.ok) { this.loadOrders(); this.loadStats(); }
    }
};

DUI.openMissionDetail = async function(orderId) {
    // UI Feedback
    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    try {
        const res = await fetch(`${API_BASE}/api/delivery/order_details/${orderId}/${this.currentDgId}`);
        const data = await res.json();
        
        if (data.status === 'ok') {
            const o = data.order;
            
            // 1. Core Intel
            document.getElementById('rm-id').innerText = `ORD_TX: #UB-${o.id}`;
            document.getElementById('rm-customer-name').innerText = o.customer_name;
            document.getElementById('rm-phone-link').href = `tel:${o.customer_phone}`;
            
            // 2. Financials
            const unpaid = o.total_price - o.upfront_paid;
            document.getElementById('rm-unpaid').innerText = `${unpaid.toLocaleString()}`;
            document.getElementById('rm-upfront').innerText = `${o.upfront_paid.toLocaleString()}`;

            // 3. Manifest Rendering
            const list = document.getElementById('rm-items-list');
            document.getElementById('rm-item-count').innerText = `${o.items.length} UNITS`;
            
            list.innerHTML = o.items.map(item => `
                <div class="flex justify-between items-center p-4 bg-white/[0.03] rounded-2xl border border-white/5 group hover:border-orange-500/30 transition-all">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-2 rounded-full bg-orange-500/20 group-hover:bg-orange-500 transition-all"></div>
                        <div>
                            <p class="text-xs font-black text-white uppercase italic">${item.name}</p>
                            <p class="text-[9px] mono text-slate-500">QUANTITY: ${item.quantity}</p>
                        </div>
                    </div>
                    <span class="text-[10px] font-black text-slate-400 mono">${item.price} ETB</span>
                </div>
            `).join('');

            // 4. Finalize Button Logic
            document.getElementById('rm-complete-btn').onclick = () => {
                this.closeRiderModal();
                this.completeOrder(o.id);
            };

            // Show Modal
            const modal = document.getElementById('rider-modal');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            if (missionInterval) clearInterval(missionInterval);
        
        const startTime = new Date(o.created_at).getTime();
        
        missionInterval = setInterval(() => {
            const now = new Date().getTime();
            const diff = now - startTime;
            
            const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            
            document.getElementById('rm-timer').innerText = `${h}:${m}:${s}`;
            
            // Visual bar fills over 60 minutes for "Priority" feel
            const percent = Math.min((diff / 3600000) * 100, 100);
            document.getElementById('rm-timer-bar').style.width = `${percent}%`;
        }, 1000);
        }
    } catch (e) { 
        console.error("Intelligence Uplink Failed", e); 
    }
};

DUI.closeRiderModal = function() {
    if (missionInterval) clearInterval(missionInterval); // Kill timer to save battery
    const modal = document.getElementById('rider-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

DUI.showSuccess = function() {
    const popup = document.getElementById('success-popup');
    popup.classList.remove('hidden');
    popup.classList.add('flex');

    // Trigger Telegram vibration if available
    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }

    // Hide after 2 seconds
    setTimeout(() => {
        popup.classList.add('fade-out');
        setTimeout(() => {
            popup.classList.remove('flex', 'fade-out');
            popup.classList.add('hidden');
        }, 300);
    }, 2000);
};



// HELPER: Small clean card for deep stats
DUI.buildMiniCard = function(label, val, icon, color) {
    return `
    <div class="glass-ui p-5 rounded-[2.2rem] border border-white/5 bg-white/[0.01] animate-in zoom-in-95 duration-500">
        <p class="text-[7px] mono text-slate-500 uppercase tracking-widest mb-1">${label}</p>
        <h4 class="text-base font-black italic tracking-tighter ${color}">${val || 0}</h4>
    </div>`;
};

document.addEventListener('DOMContentLoaded', () => {
  DUI.init();
});
