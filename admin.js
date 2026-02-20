/** * UniBites Admin - Core Engine v3.0
 * Fully Dynamic Integration with Aiohttp Backend
 */

const API_BASE = "https://deliveraau.onrender.com/api";
let charts = {}; // Store chart instances

const UI = {
    currentOrders: [],

    init() {
        this.bindEvents();
        this.checkAuth();
    },

    bindEvents() {
        // Tab Switching
        document.querySelectorAll('.nav-link').forEach(btn => {
            btn.onclick = () => this.switchView(btn.dataset.view);
        });

        // Auth
        document.getElementById('loginBtn').onclick = () => this.handleLogin();
        document.getElementById('logoutBtn').onclick = () => this.logout();
        
        // Refresh Actions
        document.getElementById('refreshOrders')?.addEventListener('click', () => this.loadOrders());
    },

    // --- CORE NETWORKING ---
    async apiRequest(endpoint, options = {}) {
        const token = localStorage.getItem('admin_token');
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
            if (res.status === 401) this.logout();
            return await res.json();
        } catch (e) {
            console.error(`Uplink Error [${endpoint}]:`, e);
            return { status: 'error' };
        }
    },

    checkAuth() {
        const token = localStorage.getItem('admin_token');
        if (token) {
            document.getElementById('loginOverlay').classList.add('hidden');
            document.getElementById('adminContent').classList.remove('hidden');
            const lastView = localStorage.getItem('current_view') || 'analytics';
            this.switchView(lastView);
        }
    },

    async handleLogin() {
        const user = document.getElementById('adminUser').value;
        const pass = document.getElementById('adminPass').value;
        const btn = document.getElementById('loginBtn');
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        
        const data = await this.apiRequest('/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username: user, password: pass })
        });

        if (data.status === 'ok') {
            localStorage.setItem('admin_token', data.token);
            location.reload();
        } else {
            this.showError();
            btn.textContent = 'Authorize';
        }
    },

    showError() {
        const err = document.getElementById('loginError');
        err.classList.remove('hidden');
        setTimeout(() => err.classList.add('hidden'), 3000);
    },

    async switchView(viewId) {
        document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
        document.getElementById(`${viewId}View`).classList.remove('hidden');
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.toggle('active', l.dataset.view === viewId);
        });
        document.getElementById('viewTitle').textContent = `Mission: ${viewId}`;
        localStorage.setItem('current_view', viewId);

        // View-Specific Loaders
        switch(viewId) {
            case 'analytics': this.loadDashboard(); break;
            case 'orders': this.loadOrders(); break;
            case 'grocery': this.loadInventory(); break;
            case 'users': this.loadUsers(); break;
        }
    },

    // --- ANALYTICS ENGINE ---
    async loadDashboard() {
        const [stats, statusSplit, paymentSplit, speed, heatmap, campus, alerts, latest] = await Promise.all([
            this.apiRequest('/admin/dashboard/stats'),
            this.apiRequest('/admin/dashboard/order-status-breakdown'),
            this.apiRequest('/admin/dashboard/payment-method-split'),
            this.apiRequest('/admin/dashboard/fulfillment-speed'),
            this.apiRequest('/admin/dashboard/order-heatmap'),
            this.apiRequest('/admin/dashboard/campus-distribution'),
            this.apiRequest('/admin/dashboard/stock-alerts'),
            this.apiRequest('/admin/latest-orders')
        ]);

        if (stats.status === 'ok') this.updateKPIs(stats.kpis);
        if (stats.trend) this.renderLineChart('orderTrendChart', stats.trend, 'total', '#FF7A00');
        if (statusSplit.data) this.renderPieChart('statusPieChart', statusSplit.data, 'status', 'count');
        if (paymentSplit.data) this.renderPieChart('paymentPieChart', paymentSplit.data, 'method', 'count');
        if (speed.status === 'ok') this.updateFulfillmentUI(speed);
        if (heatmap.hourly) this.renderBarChart('orderHeatmapChart', heatmap.hourly, 'hour', 'orders', '#FF7A00');
        if (campus.data) this.renderBarChart('campusChart', campus.data, 'campus', 'orders', '#3b82f6');
        if (alerts.alerts) this.renderStockAlerts(alerts.alerts);
        if (latest.orders) this.renderLatestFeed(latest.orders);
    },

    updateKPIs(kpis) {
        document.getElementById('statRevenue').textContent = kpis.net_revenue.toLocaleString();
        document.getElementById('statPending').textContent = kpis.pending_orders;
        document.getElementById('statInventory').textContent = kpis.live_items;
        document.getElementById('statUsers').textContent = kpis.total_customers;
        document.getElementById('statRepeat').textContent = kpis.repeat_pct.toFixed(1);
        document.getElementById('statAOV').textContent = Math.round(kpis.aov);
    },

    updateFulfillmentUI(data) {
        document.getElementById('speedAvg').textContent = data.avg_hours.toFixed(1);
        document.getElementById('speedMedian').textContent = data.median_hours.toFixed(1);
        document.getElementById('speedP95').textContent = data.p95_hours.toFixed(1);
    },

    renderStockAlerts(alerts) {
        const container = document.getElementById('stockAlertsList');
        container.innerHTML = alerts.map(a => `
            <div class="flex justify-between items-center p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                <div>
                    <div class="text-[10px] font-bold text-white uppercase">${a.item_name}</div>
                    <div class="text-[8px] mono text-slate-500">${a.variant_name}</div>
                </div>
                <div class="text-rose-500 font-black mono text-xs">${a.stock} LEFT</div>
            </div>
        `).join('') || '<p class="mono text-[10px] text-slate-500">SYSTEM NOMINAL: NO ALERTS</p>';
    },

    renderLatestFeed(orders) {
        const container = document.getElementById('latestOrdersFeed');
        container.innerHTML = orders.map(o => `
            <div class="flex justify-between items-center p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all cursor-pointer" onclick="UI.viewOrderDetails(${o.id})">
                <div class="flex items-center gap-4">
                    <div class="w-2 h-2 rounded-full ${o.status === 'pending' ? 'bg-orange-500 animate-pulse' : 'bg-slate-600'}"></div>
                    <div>
                        <div class="text-[10px] font-black text-white">#${o.id.toString().slice(-6)}</div>
                        <div class="text-[8px] mono text-slate-500">${new Date(o.created_at).toLocaleTimeString()}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-[10px] font-bold text-white">${o.total_price} ETB</div>
                    <div class="text-[8px] mono text-orange-500 uppercase">${o.status}</div>
                </div>
            </div>
        `).join('');
    },

    // --- CHARTING UTILS ---
    renderLineChart(id, data, key, color) {
        const ctx = document.getElementById(id).getContext('2d');
        if (charts[id]) charts[id].destroy();
        charts[id] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date ? new Date(d.date).toLocaleDateString([], {weekday:'short'}) : d.hour),
                datasets: [{
                    data: data.map(d => d[key]),
                    borderColor: color,
                    backgroundColor: `${color}22`,
                    fill: true, tension: 0.4, borderWidth: 3, pointRadius: 2
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } } }
        });
    },

    renderPieChart(id, data, labelKey, valueKey) {
        const ctx = document.getElementById(id).getContext('2d');
        if (charts[id]) charts[id].destroy();
        charts[id] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d[labelKey].toUpperCase()),
                datasets: [{
                    data: data.map(d => d[valueKey]),
                    backgroundColor: ['#FF7A00', '#3b82f6', '#10b981', '#f43f5e', '#8b5cf6'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 9, family: 'monospace' } } } }, cutout: '70%' }
        });
    },

    renderBarChart(id, data, labelKey, valueKey, color) {
        const ctx = document.getElementById(id).getContext('2d');
        if (charts[id]) charts[id].destroy();
        charts[id] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d[labelKey]),
                datasets: [{ data: data.map(d => d[valueKey]), backgroundColor: color, borderRadius: 5 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } } }
        });
    },

    // --- DATA LOADERS (TABLES) ---
async loadOrders() {
    const list = document.getElementById('orderList');
    
    // Loading State
    list.innerHTML = `
        <tr>
            <td colspan="5" class="p-20 text-center">
                <div class="flex flex-col items-center gap-3">
                    <i class="fa-solid fa-circle-notch fa-spin text-orange-500 text-xl"></i>
                    <span class="mono text-[10px] uppercase tracking-widest text-slate-400">Syncing Database...</span>
                </div>
            </td>
        </tr>`;

    const data = await this.apiRequest('/admin/orders');
    
    if (data.status === 'ok') {
        this.currentOrders = data.orders;
        
        // Configuration for Status Emblems
        const statusMap = {
            pending:    { icon: 'fa-clock',      color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
            processing: { icon: 'fa-gears',      color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/20' },
            shipped:    { icon: 'fa-truck',      color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
            completed:  { icon: 'fa-check-circle',color: 'text-emerald-400',bg: 'bg-emerald-400/10',border: 'border-emerald-400/20' },
            cancelled:  { icon: 'fa-ban',         color: 'text-rose-500',   bg: 'bg-rose-500/10',   border: 'border-rose-500/20' }
        };

        list.innerHTML = data.orders.map(o => {
            const status = o.status.toLowerCase();
            const config = statusMap[status] || statusMap.pending;
                const displayName = o.first_name ? o.first_name : `User_${o.user_id}`;


           
  return `
    <tr class="group hover:bg-white/[0.03] border-b border-white/5 transition-all duration-200">
      <td class="p-6">
        <div class="flex flex-col gap-1">
          <span class="font-bold mono text-xs text-white tracking-tight">#${o.id.toString().slice(-6)}</span>
          <span class="text-[9px] text-slate-500 uppercase">${new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
      </td>

      <td class="p-6">
        <div class="flex flex-col">
          <span class="uppercase italic font-black text-white tracking-tight">${displayName}</span>
          <span class="text-[9px] mono text-slate-500">${o.campus || 'Unknown Campus'}</span>
        </div>
      </td>

      <td class="p-6">
        <div class="flex flex-col">
          <span class="font-black text-orange-500 text-sm">${o.total_price.toLocaleString()} <span class="text-[10px]">ETB</span></span>
        </div>
      </td>

      <td class="p-6">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border ${config.bg} ${config.color} ${config.border}">
          <i class="fa-solid ${config.icon} text-[10px]"></i>
          <span class="text-[10px] font-bold uppercase tracking-tighter">${status}</span>
        </div>
      </td>

      <td class="p-6 text-right">
        <button onclick="UI.viewOrderDetails(${o.id})" 
          class="px-5 py-2 bg-white/5 rounded-xl border border-white/10 text-white mono text-[10px] font-bold uppercase hover:bg-orange-500 hover:text-black hover:border-orange-500 transition-all active:scale-95">
          Details
        </button>
      </td>
    </tr>
  `;
}).join('');

    } else {
        list.innerHTML = `<tr><td colspan="5" class="p-20 text-center text-rose-500 mono text-xs uppercase">Failed to load orders.</td></tr>`;
    }
},

    async loadInventory() {
        const list = document.getElementById('inventoryList');
        const data = await this.apiRequest('/asbeza/items');
        if (data.items) {
            list.innerHTML = data.items.map(i => `
                <tr class="border-b border-white/5">
                    <td class="p-6 flex items-center gap-4">
                        <img src="${i.image_url}" class="w-10 h-10 rounded-lg object-cover">
                        <div><div class="font-bold text-white uppercase text-xs">${i.name}</div><div class="text-[8px] mono text-slate-500">ID: ${i.id}</div></div>
                    </td>
                    <td class="p-6 mono text-xs">${i.base_price} ETB</td>
                    <td class="p-6"><span class="px-2 py-1 bg-white/5 rounded text-[9px] mono">${i.variant_count || 0} VARIANTS</span></td>
                    <td class="p-6 text-right"><button class="text-slate-500 hover:text-white"><i class="fa-solid fa-ellipsis-vertical"></i></button></td>
                </tr>
            `).join('');
        }
    },

    async loadUsers() {
        const list = document.getElementById('userList');
        const data = await this.apiRequest('/admin/orders'); // Re-using user IDs from orders for this demo, usually you'd have /admin/users
        // Mapping a unique user set from orders for visualization
        const users = [...new Map(data.orders.map(o => [o.user_id, o])).values()];
        
        list.innerHTML = users.map(u => `
            <tr class="border-b border-white/5 hover:bg-white/[0.02]">
                <td class="p-6 flex items-center gap-4">
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${u.user_id}" class="w-10 h-10 rounded-full bg-slate-800">
                    <div class="font-bold text-white uppercase text-xs">User_${u.user_id}</div>
                </td>
                <td class="p-6 mono text-[10px] text-slate-400">AAIT Campus</td>
                <td class="p-6"><span class="text-orange-500 font-bold">500</span> <span class="text-[9px] text-slate-500">BC</span></td>
                <td class="p-6"><span class="text-emerald-500 text-[9px] mono">ACTIVE</span></td>
                <td class="p-6 text-right"><button onclick="UI.viewUserDetails(${u.user_id})" class="text-orange-500 hover:scale-110 transition-transform"><i class="fa-solid fa-id-card"></i></button></td>
            </tr>
        `).join('');
    },

    // --- MODAL OPERATIONS ---
    async viewUserDetails(id) {
        const data = await this.apiRequest(`/admin/users/${id}`);
        if (data.status === 'ok') {
            const u = data.user;
            document.getElementById('userDetailAvatar').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`;
            document.getElementById('userDetailName').textContent = u.first_name || `User_${u.id}`;
            document.getElementById('userDetailPhone').textContent = u.phone || 'NO PHONE';
            document.getElementById('userDetailLevel').textContent = u.level;
            document.getElementById('userDetailCoins').textContent = u.coins;
            document.getElementById('userDetailCampus').textContent = u.campus;
            document.getElementById('userTotalSpent').textContent = `${data.summary.lifetime_value} ETB`;
            document.getElementById('userOrderCount').textContent = data.summary.total_orders;

            document.getElementById('userFavItems').innerHTML = data.favorites.map(f => `
                <div class="flex justify-between text-[10px] mono border-b border-white/5 pb-1">
                    <span class="text-slate-400">${f.name}</span>
                    <span class="text-white">${f.qty}x</span>
                </div>
            `).join('');

            document.getElementById('userRecentOrders').innerHTML = data.recent_orders.map(o => `
                <div class="p-3 bg-white/5 rounded-xl flex justify-between items-center text-[10px] mono">
                    <span>#${o.id}</span>
                    <span class="text-slate-500">${new Date(o.created_at).toLocaleDateString()}</span>
                    <span class="font-bold text-orange-500">${o.total_price} ETB</span>
                </div>
            `).join('');

            document.getElementById('userModal').classList.remove('hidden');
        }
    },

 async viewOrderDetails(id) {
    const data = await this.apiRequest(`/admin/orders/${id}`);
    const summary = this.currentOrders.find(o => o.id === id);

    if (data.status === 'ok' && summary) {
        // --- 1. Header & ID ---
        document.getElementById('modalOrderId').textContent = `#${summary.id.toString().slice(-6)}`;
        
        // Time Logic
        const created = new Date(summary.created_at);
        const now = new Date();
        const diffSec = Math.floor((now - created) / 1000);
        const agoText = diffSec < 60 ? `${diffSec}s ago` : 
                        diffSec < 3600 ? `${Math.floor(diffSec/60)}m ago` : 
                        diffSec < 86400 ? `${Math.floor(diffSec/3600)}h ago` : 
                        `${Math.floor(diffSec/86400)}d ago`;

        document.getElementById('modalOrderDate').textContent = `${created.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} (${agoText})`;

        // --- 2. Status Select Appearance ---
        const statusSelect = document.getElementById('updateStatusSelect');
        statusSelect.value = summary.status.toLowerCase();

        // --- 3. Items Manifest (Visual Enhancement) ---
        document.getElementById('modalItemsList').innerHTML = data.items.map(item => `
            <div class="flex justify-between items-center bg-white/[0.03] p-3 rounded-xl border border-white/5 hover:bg-white/[0.06] transition-all">
                <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 font-black text-xs">
                        ${item.quantity}x
                    </div>
                    <div>
                        <div class="text-[11px] font-bold text-white uppercase leading-tight">${item.item_name}</div>
                        <div class="text-[9px] mono text-slate-500 uppercase tracking-tighter">${item.variant_name}</div>
                    </div>
                </div>
                <div class="text-xs font-bold text-slate-200">${(item.price * item.quantity).toLocaleString()} <span class="text-[8px] text-slate-500">ETB</span></div>
            </div>
        `).join('');

        // --- 4. Proof of Payment ---
        const proofImg = document.getElementById('modalProofImg');
        proofImg.src = summary.payment_proof_url || "https://placehold.co/400x600?text=No+Receipt+Uploaded";

        // --- 5. Order Summary (The "Financial" Block) ---
        const s = data.order;
        const summaryGrid = {
            'modalSummaryItems': s.total_items,
            'modalSummaryQty': s.total_quantity,
            'modalSummaryTotal': `<span class="text-orange-500 font-bold">${s.total_price} ETB</span>`,
            'modalSummaryUpfront': `<span class="text-emerald-400">${s.upfront_paid} ETB</span>`,
            'modalSummaryDelivery': `${s.delivery_fee || 0} ETB`
        };
        Object.keys(summaryGrid).forEach(key => {
            document.getElementById(key).innerHTML = summaryGrid[key];
        });

        // --- 6. User Intelligence ---
        if (data.user) {
            document.getElementById('modalUserTelegram').innerHTML = `<span class="text-sky-400">@${data.user.telegram_id || 'hidden'}</span>`;
            document.getElementById('modalUserName').textContent = data.user.full_name || data.user.first_name || "Guest User";
            document.getElementById('modalUserPhone').textContent = data.user.phone || "N/A";
            document.getElementById('modalUserCampus').innerHTML = `<span class="px-2 py-0.5 rounded bg-white/10 text-[10px]">${data.user.campus || "N/A"}</span>`;
        }

        // --- 7. Final Bind & Reveal ---
        document.getElementById('saveStatusBtn').onclick = () => this.updateOrderStatus(id);
        document.getElementById('orderModal').classList.remove('hidden');
    }
},
    async updateOrderStatus(id) {
        const newStatus = document.getElementById('updateStatusSelect').value;
        const btn = document.getElementById('saveStatusBtn');
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> UPDATING';
        const res = await this.apiRequest(`/admin/orders/${id}/status`, {
            method: 'POST',
            body: JSON.stringify({ status: newStatus })
        });
        if (res.status === 'ok') {
            btn.textContent = 'SUCCESS';
            setTimeout(() => {
                this.closeModal();
                this.loadOrders();
                btn.textContent = 'COMMIT CHANGE';
            }, 1000);
        }
    },

    closeModal() {
        document.getElementById('orderModal').classList.add('hidden');
    },

    logout() {
        localStorage.removeItem('admin_token');
        location.reload();
    }
};

// Global Exposure
window.UI = UI;
window.closeUserModal = () => document.getElementById('userModal').classList.add('hidden');
UI.init();
