/** * UniBites Admin - Core Engine v3.0
 * Fully Dynamic Integration with Aiohttp Backend
 */


const ASBEZA_CATEGORIES = [
    "Staples",     // e.g., Flour, Oil, Rice
    "Vegetables",  // e.g., Tomatoes, Onions
    "Snacks",      // e.g., Biscuits, Chips
    "Drinks",      // e.g., Water, Soft drinks
    "Personal Care", // e.g., Soap, Tissue
    "Other"
];

const API_BASE = "https://deliveraau.onrender.com/api";
let charts = {}; // Store chart instances

const UI = {
    currentOrders: [],
    currentPage: 1,
    itemsPerPage: 10,
    inventoryItems: [],
    invPage: 1,
    invLimit: 10,
    users: [],
    userPage: 1,
    userLimit: 10,

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

  async apiRequest(endpoint, options = {}) {
        const token = localStorage.getItem('admin_token');
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
            
            // If session expired, boot to login
            if (res.status === 401) {
                this.logout();
                return { status: 'error', message: 'Session Expired' };
            }

            return await res.json();
        } catch (e) {
            console.error(`🔴 Uplink Error [${endpoint}]:`, e);
            this.notify("Network Link Severed", "error");
            return { status: 'error' };
        }
    },

    /**
     * Simple Toast Notification
     * Prevents the need for alert() popups
     */
    notify(msg, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-8 right-8 z-[200] px-6 py-3 rounded-2xl border backdrop-blur-xl 
                          text-[11px] mono font-black tracking-widest transition-all duration-500 transform translate-y-20`;
        
        const colors = {
            success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
            error: 'bg-rose-500/10 border-rose-500/20 text-rose-500',
            info: 'bg-sky-500/10 border-sky-500/20 text-sky-500'
        };

        toast.classList.add(...colors[type].split(' '));
        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-triangle-exclamation'} mr-2"></i> ${msg.toUpperCase()}`;
        
        document.body.appendChild(toast);
        
        // Animation
        setTimeout(() => toast.classList.remove('translate-y-20'), 100);
        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-4');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
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
            // this.apiRequest('/admin/dashboard/stock-alerts'),
            this.apiRequest('/admin/latest-orders')
        ]);

        if (stats.status === 'ok') this.updateKPIs(stats.kpis);
        console.log('this is the trend', stats.trend)
        if (stats.trend) {
this.renderLineChart('orderTrendChart', stats.trend, 'total', '#FF7A00');
this.renderGrowthChart('revenueTrendChart', stats.trend);
        }
        if (statusSplit.data) this.renderPieChart('statusPieChart', statusSplit.data, 'status', 'count');
        if (paymentSplit.data) this.renderPieChart('paymentPieChart', paymentSplit.data, 'method', 'count');
        if (speed.status === 'ok') this.updateFulfillmentUI(speed);
        if (heatmap.hourly) this.renderBarChart('orderHeatmapChart', heatmap.hourly, 'hour', 'orders', '#FF7A00');
        if (campus.data) this.renderBarChart('campusChart', campus.data, 'campus', 'orders', '#3b82f6');
        // if (alerts.alerts) this.renderStockAlerts(alerts.alerts);
        if (latest.orders) this.renderLatestFeed(latest.orders);
    
    },

    updateKPIs(kpis) {
    // Existing KPIs
    document.getElementById('statRevenue').textContent = kpis.net_revenue.toLocaleString();
    document.getElementById('statPending').textContent = kpis.pending_orders;
    document.getElementById('statInventory').textContent = kpis.live_items;
    document.getElementById('statUsers').textContent = kpis.total_customers;
    document.getElementById('statRepeat').textContent = kpis.repeat_pct.toFixed(1);
    // document.getElementById('statAOV').textContent = Math.round(kpis.aov);

    // NEW: Profit & Margin KPIs
   if (document.getElementById('statTotalProfit')) {
  if (kpis && typeof kpis.total_profit === 'number') {
    document.getElementById('statTotalProfit').textContent = kpis.total_profit.toLocaleString();
  } else {
    document.getElementById('statTotalProfit').textContent = "0"; // fallback if empty DB
  }
}

if (document.getElementById('statMarginPct')) {
  if (kpis && typeof kpis.margin_pct === 'number') {
    document.getElementById('statMarginPct').textContent = kpis.margin_pct.toFixed(1);
  } else {
    document.getElementById('statMarginPct').textContent = "0.0"; // fallback
  }
}

},

    updateFulfillmentUI(data) {
        document.getElementById('speedAvg').textContent = data.avg_hours.toFixed(1);
        document.getElementById('speedMedian').textContent = data.median_hours.toFixed(1);
        document.getElementById('speedP95').textContent = data.p95_hours.toFixed(1);
    },

    renderGrowthChart (canvasId, trendData) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  
  // Destroy existing chart if it exists to prevent memory leaks
  if (window.myGrowthChart) window.myGrowthChart.destroy();

  window.myGrowthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trendData.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      }),
      datasets: [
        {
          label: 'PROFIT',
          data: trendData.map(d => d.profit),
          borderColor: '#10B981', // Emerald Green
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: '#10B981'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#94a3b8', font: { family: 'monospace', size: 10 } }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#64748b', font: { size: 9 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 9 } }
        }
      }
    }
  });
},

    // renderStockAlerts(alerts) {
    //     const container = document.getElementById('stockAlertsList');
    //     container.innerHTML = alerts.map(a => `
    //         <div class="flex justify-between items-center p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
    //             <div>
    //                 <div class="text-[10px] font-bold text-white uppercase">${a.item_name}</div>
    //                 <div class="text-[8px] mono text-slate-500">${a.variant_name}</div>
    //             </div>
    //             <div class="text-rose-500 font-black mono text-xs">${a.stock} LEFT</div>
    //         </div>
    //     `).join('') || '<p class="mono text-[10px] text-slate-500">SYSTEM NOMINAL: NO ALERTS</p>';
    // },

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
        list.innerHTML = `<tr><td colspan="5" class="p-20 text-center"><i class="fa-solid fa-circle-notch fa-spin text-orange-500"></i></td></tr>`;

        const data = await this.apiRequest('/admin/orders');
        
        if (data.status === 'ok') {
            this.currentOrders = data.orders;
            this.currentPage = 1; // Reset to page 1 on refresh

            // Setup Filter & Pagination listeners once
            const filter = document.getElementById('statusFilter');
            if (filter && !filter.dataset.bound) {
                filter.onchange = () => { this.currentPage = 1; this.renderOrders(); };
                filter.dataset.bound = "true";
            }
            
            this.renderOrders();
        }
    },

    renderOrders() {
        const list = document.getElementById('orderList');
        const filterValue = document.getElementById('statusFilter').value;
        const counter = document.getElementById('orderCount');

        // 1. Filter Logic
        let filtered = filterValue 
            ? this.currentOrders.filter(o => o.status.toLowerCase() === filterValue)
            : this.currentOrders;

        // 2. Pagination Logic
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        // Ensure current page is within bounds
        if (this.currentPage > totalPages) this.currentPage = totalPages || 1;
        
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const paginatedItems = filtered.slice(start, end);

        // Update UI Counter
        if (counter) counter.textContent = `${totalItems.toString().padStart(2, '0')} UNITS`;

        // Update Pagination Controls (Bottom)
        this.updatePaginationUI(totalPages);

        if (paginatedItems.length === 0) {
            list.innerHTML = `<tr><td colspan="5" class="p-20 text-center text-slate-500 mono text-[10px]">No transmissions found.</td></tr>`;
            return;
        }

        const statusMap = {
            pending:    { icon: 'fa-clock', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
            processing: { icon: 'fa-gears', color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/20' },
            shipped:    { icon: 'fa-truck', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
            completed:  { icon: 'fa-check-circle', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
            cancelled:  { icon: 'fa-ban', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' }
        };

        list.innerHTML = paginatedItems.map(o => {
            const status = o.status.toLowerCase();
            const config = statusMap[status] || statusMap.pending;
            const displayName = o.first_name || `User_${o.user_id}`;

            return `
                <tr class="group hover:bg-white/[0.03] border-b border-white/5 transition-all duration-200">
                    <td class="p-6">
                        <div class="flex flex-col gap-1">
                            <span class="font-bold mono text-xs text-white">#${o.id.toString().slice(-6)}</span>
                            <span class="text-[9px] text-slate-500 uppercase">${new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                    </td>
                    <td class="p-6 text-center">
                        <div class="flex flex-col items-center">
                            <span class="uppercase italic font-black text-white leading-none">${displayName}</span>
                            <span class="text-[8px] mono text-slate-500 mt-1 uppercase tracking-tighter">${o.campus || 'N/A'}</span>
                        </div>
                    </td>
                    <td class="p-6 text-center italic font-black text-orange-500">${o.total_price.toLocaleString()} ETB</td>
                    <td class="p-6 text-center">
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border ${config.bg} ${config.color} ${config.border}">
                            <i class="fa-solid ${config.icon} text-[10px]"></i>
                            <span class="text-[9px] font-bold uppercase tracking-widest">${status}</span>
                        </div>
                    </td>
                    <td class="p-6 text-right">
                        <button onclick="UI.viewOrderDetails(${o.id})" class="px-5 py-2 bg-white/5 rounded-xl border border-white/10 text-white mono text-[10px] font-bold hover:bg-orange-500 hover:text-black transition-all">
                            Details
                        </button>
                    </td>
                </tr>`;
        }).join('');
    },

    updatePaginationUI(totalPages) {
        const container = document.getElementById('paginationControls');
        if (!container) return;

        container.innerHTML = `
            <div class="flex items-center gap-4">
                <button onclick="UI.changePage(-1)" ${this.currentPage === 1 ? 'disabled' : ''} 
                    class="p-2 w-10 h-10 rounded-lg bg-white/5 border border-white/10 text-white disabled:opacity-20 hover:bg-orange-500 hover:text-black transition-all">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <span class="mono text-[10px] text-slate-400 uppercase tracking-widest">
                    Page <span class="text-white font-black">${this.currentPage}</span> of ${totalPages || 1}
                </span>
                <button onclick="UI.changePage(1)" ${this.currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} 
                    class="p-2 w-10 h-10 rounded-lg bg-white/5 border border-white/10 text-white disabled:opacity-20 hover:bg-orange-500 hover:text-black transition-all">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
        `;
    },

    changePage(step) {
        this.currentPage += step;
        this.renderOrders();
        // Smooth scroll back to top of table
        document.getElementById('ordersView').scrollIntoView({ behavior: 'smooth' });
    },

async loadInventory() {
  const list = document.getElementById('inventoryList');
  list.innerHTML = `<tr><td colspan="4" class="p-20 text-center text-orange-500 mono animate-pulse text-[10px]">SYNCING INVENTORY...</td></tr>`;

  try {
    // Matches your Python route: list_items_admin
    const data = await this.apiRequest('/admin/items'); // ✅ use admin route

    if (data.status === 'ok') {
      this.inventoryItems = data.items;
      this.invPage = 1;

      const searchInput = document.getElementById('inventorySearch');
      if (searchInput && !searchInput.dataset.bound) {
        searchInput.oninput = () => { this.invPage = 1; this.renderInventory(); };
        searchInput.dataset.bound = "true";
      }

      this.renderInventory();
    } else {
      // Show backend error message if available
      list.innerHTML = `<tr><td colspan="4" class="p-20 text-center text-rose-500 mono text-[10px]">ERROR: ${data.message || 'Unknown issue'}</td></tr>`;
    }
  } catch (err) {
    // Catch network/JSON errors
    list.innerHTML = `<tr><td colspan="4" class="p-20 text-center text-rose-500 mono text-[10px]">REQUEST FAILED: ${err.message}</td></tr>`;
  }
},


renderInventory() {
    const list = document.getElementById('inventoryList');
    const searchTerm = document.getElementById('inventorySearch').value.toLowerCase();
    
    const filtered = this.inventoryItems.filter(i => 
        i.name.toLowerCase().includes(searchTerm)
    );

    const totalPages = Math.ceil(filtered.length / this.invLimit);
    const start = (this.invPage - 1) * this.invLimit;
    const paginated = filtered.slice(start, start + this.invLimit);

    list.innerHTML = paginated.map(i => `
        <tr class="group hover:bg-white/[0.03] transition-all border-b border-white/5">
            <td class="p-6">
                <div class="flex items-center gap-4">
                    <div class="relative w-12 h-12 rounded-xl overflow-hidden border border-white/10 shadow-inner">
                        <img src="${i.image_url}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                    </div>
                    <div>
                        <div class="font-bold text-white uppercase text-xs tracking-tight leading-none">${i.name}</div>
                        <div class="text-[9px] mono text-slate-500 mt-1 uppercase">ID: ${i.id}</div>
                    </div>
                </div>
            </td>
            <td class="p-6 text-center">
                <span class="mono text-xs font-black text-orange-500 italic">${i.base_price.toLocaleString()} ETB</span>
            </td>
            <td class="p-6 text-center">
                <span class="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] mono font-bold text-slate-400">
                    ${i.variant_count || 0} VARIANTS
                </span>
            </td>
            <td class="p-6 text-right">
                <div class="flex justify-end gap-2">
                    <button onclick="UI.editInventoryItem(${i.id})" 
                        class="w-9 h-9 rounded-xl bg-white/5 border border-white/5 hover:bg-orange-500 hover:text-black transition-all flex items-center justify-center shadow-lg active:scale-90">
                        <i class="fa-solid fa-pen-to-square text-[10px]"></i>
                    </button>
                    <button onclick="UI.deleteInventoryItem(${i.id}, '${i.name}')" 
                        class="w-9 h-9 rounded-xl bg-white/5 border border-white/5 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-lg active:scale-90">
                        <i class="fa-solid fa-trash text-[10px]"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    this.renderInventoryPagination(totalPages);
},

// Logic for backend: delete_item_admin
async deleteInventoryItem(id, name) {
    if (!confirm(`Are you sure you want to delete ${name}? This will also delete all associated variants.`)) return;

    // Call your delete route: /adminf/items/{id}
    const response = await this.apiRequest(`/admin/items/${id}`, { method: 'DELETE' });
    
    if (response.status === 'ok') {
        // Refresh local data and reload
        this.loadInventory();
    } else {
        alert("Failed to delete item.");
    }
},



renderInventoryPagination(totalPages) {
    const container = document.getElementById('inventoryPagination');
    if (!container) return;
    
    container.innerHTML = `
        <div class="flex items-center gap-4">
            <button onclick="UI.changeInvPage(-1)" ${this.invPage === 1 ? 'disabled' : ''} 
                class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-10 hover:bg-orange-500 hover:text-black transition-all active:scale-95 flex items-center justify-center">
                <i class="fa-solid fa-chevron-left text-[10px]"></i>
            </button>
            <span class="mono text-[10px] text-slate-500 uppercase tracking-widest">
                Page <span class="text-white font-black">${this.invPage}</span> / ${totalPages || 1}
            </span>
            <button onclick="UI.changeInvPage(1)" ${this.invPage === totalPages || totalPages === 0 ? 'disabled' : ''} 
                class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-10 hover:bg-orange-500 hover:text-black transition-all active:scale-95 flex items-center justify-center">
                <i class="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
        </div>
    `;
},

changeInvPage(step) {
    this.invPage += step;
    this.renderInventory();
    document.getElementById('groceryView').scrollIntoView({ behavior: 'smooth' });
},

  // Add to your UI state


async loadUsers() {
    const list = document.getElementById('userList');
    list.innerHTML = `<tr><td colspan="5" class="p-20 text-center"><i class="fa-solid fa-circle-notch fa-spin text-orange-500"></i></td></tr>`;

    const data = await this.apiRequest('/admin/users');
    
    if (data.status === 'ok') {
        this.users = data.users;
        this.userPage = 1;

        // Bind Search Event once
        const searchInput = document.getElementById('userSearch');
        if (searchInput && !searchInput.dataset.bound) {
            searchInput.oninput = () => { this.userPage = 1; this.renderUsers(); };
            searchInput.dataset.bound = "true";
        }

        this.renderUsers();
    } else {
        list.innerHTML = `<tr><td colspan="5" class="p-20 text-center text-rose-500 mono text-[10px]">FAILED TO LOAD PERSONNEL DATA</td></tr>`;
    }
},


viewFullImage() {
    const sourceImg = document.getElementById('modalProofImg').src;
    const lightbox = document.getElementById('imageLightbox');
    const lightboxImg = document.getElementById('lightboxImg');

    if (sourceImg) {
        lightboxImg.src = sourceImg;
        lightbox.classList.remove('hidden');
        // Add a nice entrance animation
        lightboxImg.classList.add('scale-95');
        setTimeout(() => lightboxImg.classList.remove('scale-95'), 10);
    }
},

renderUsers() {
    const list = document.getElementById('userList');
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    
    // 1. Filter Logic
    const filtered = this.users.filter(u => 
        (u.first_name || '').toLowerCase().includes(searchTerm) || 
        u.id.toString().includes(searchTerm)
    );

    // 2. Pagination Calculation
    const totalPages = Math.ceil(filtered.length / this.userLimit);
    const start = (this.userPage - 1) * this.userLimit;
    const paginated = filtered.slice(start, start + this.userLimit);

    // 3. Render List
    list.innerHTML = paginated.map(u => `
        <tr class="group hover:bg-white/[0.03] transition-all border-b border-white/5">
            <td class="p-6">
                <div class="flex items-center gap-4">
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}" 
                         class="w-10 h-10 rounded-full bg-slate-800 border border-white/10 group-hover:border-orange-500 transition-colors">
                    <div>
                        <div class="font-bold text-white uppercase text-xs tracking-tight">${u.first_name || 'User_' + u.id}</div>
                        <div class="text-[9px] mono text-slate-500 uppercase">UID-${u.id}</div>
                    </div>
                </div>
            </td>
            <td class="p-6 text-center">
                <span class="mono text-[10px] text-slate-400 uppercase tracking-tighter">${u.campus || 'N/A'}</span>
            </td>
            <td class="p-6 text-center">
                <div class="flex flex-col items-center">
                    <span class="text-orange-500 font-black italic text-sm">${(u.coins || 0).toLocaleString()} <span class="text-[9px] not-italic">BC</span></span>
                </div>
            </td>
            <td class="p-6 text-center">
                <span class="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[9px] mono text-emerald-500 font-bold uppercase">
                    Level ${u.level || '1'}
                </span>
            </td>
            <td class="p-6 text-right">
                <button onclick="UI.viewUserDetails(${u.id})" 
                        class="w-10 h-10 rounded-xl bg-white/5 hover:bg-orange-500 hover:text-black transition-all inline-flex items-center justify-center shadow-lg active:scale-90">
                    <i class="fa-solid fa-id-card text-xs"></i>
                </button>
            </td>
        </tr>
    `).join('');

    this.renderUserPagination(totalPages);
},

renderUserPagination(totalPages) {
    const container = document.getElementById('userPagination');
    if (!container) return;
    
    container.innerHTML = `
        <div class="flex items-center gap-4">
            <button onclick="UI.changeUserPage(-1)" ${this.userPage === 1 ? 'disabled' : ''} 
                class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-10 hover:bg-orange-500 hover:text-black transition-all flex items-center justify-center">
                <i class="fa-solid fa-chevron-left text-[10px]"></i>
            </button>
            <span class="mono text-[10px] text-slate-500 uppercase">
                Page <span class="text-white font-bold">${this.userPage}</span> / ${totalPages || 1}
            </span>
            <button onclick="UI.changeUserPage(1)" ${this.userPage === totalPages || totalPages === 0 ? 'disabled' : ''} 
                class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-10 hover:bg-orange-500 hover:text-black transition-all flex items-center justify-center">
                <i class="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
        </div>
    `;
},

changeUserPage(step) {
    this.userPage += step;
    this.renderUsers();
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
    // 1. INITIALIZE MODAL & SKELETON STATE
    // Show modal immediately to provide instant feedback
    document.getElementById('orderModal').classList.remove('hidden');
    document.getElementById('modalOrderId').textContent = `#${id.toString().slice(-6)}`;
    document.getElementById('modalOrderDate').textContent = 'Syncing...';
    
    // Clear lists and show loading spinner
    document.getElementById('modalItemsList').innerHTML = `
        <div class="flex justify-center p-6 text-slate-400 text-xs">
            <i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Fetching Tactical Data...
        </div>
    `;

    // 2. PARALLEL UPLINK (Fetch Order + Available Riders)
    // We use Promise.all so the UI waits for both datasets simultaneously
    const [data, ridersData] = await Promise.all([
        this.apiRequest(`/admin/orders/${id}`),
        this.apiRequest('/admin/delivery-guys')
    ]);

    const summary = this.currentOrders.find(o => o.id === id);

    if (data.status === 'ok' && summary) {
        // --- HEADER & TIME CALCULATIONS ---
        const created = new Date(summary.created_at);
        const now = new Date();
        const diffSec = Math.floor((now - created) / 1000);
        const agoText = diffSec < 60 ? `${diffSec}s ago` :
                        diffSec < 3600 ? `${Math.floor(diffSec/60)}m ago` :
                        diffSec < 86400 ? `${Math.floor(diffSec/3600)}h ago` :
                        `${Math.floor(diffSec/86400)}d ago`;

        document.getElementById('modalOrderDate').textContent =
            `${created.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} (${agoText})`;

        // --- STATUS CONTROL ---
        document.getElementById('updateStatusSelect').value = summary.status.toLowerCase();

        // --- ITEMS MANIFEST ---
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

        // --- PAYMENT PROOF ---
        const proofImg = document.getElementById('modalProofImg');
        proofImg.src = summary.payment_proof_url || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQsQs4bxz22n2D6_LPXQhADYVe2u3bXTrYrxw&s";

        // --- ORDER SUMMARY ---
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

        // --- USER INTELLIGENCE ---
        if (data.user) {
            document.getElementById('modalUserTelegram').innerHTML = `<span class="text-sky-400">@${data.user.telegram_id || 'hidden'}</span>`;
            document.getElementById('modalUserName').textContent = data.user.full_name || data.user.first_name || "Guest User";
            document.getElementById('modalUserPhone').textContent = data.user.phone || "N/A";
            document.getElementById('modalUserCampus').innerHTML = `<span class="px-2 py-0.5 rounded bg-white/10 text-[10px]">${data.user.campus || "N/A"}</span>`;
        }

        // --- LATEST UPDATE: TACTICAL DISPATCH LOGIC ---
        const riderSelect = document.getElementById('assignRiderSelect');
        const deployBtn = document.getElementById('assignRiderBtn');

        if (ridersData.status === 'ok' && riderSelect) {
            const currentRiderId = data.order.delivery_guy_id;
            
            // Populate Dropdown
            riderSelect.innerHTML = '<option value="">Select DG</option>' + 
                ridersData.guys.map(guy => `
                    <option value="${guy.id}" ${guy.id == currentRiderId ? 'selected' : ''}>
                        ${guy.name.toUpperCase()} — [${guy.campus}] ${guy.active ? '● ONLINE' : '○ OFFLINE'}
                    </option>
                `).join('');

            // Adaptive Button Styling
            if (currentRiderId) {
                deployBtn.innerHTML = '<i class="fa-solid fa-redo font-bold mr-2"></i>';
                deployBtn.className = "px-8 py-3 bg-slate-700 text-white font-black mono text-[11px] rounded-xl transition-all";
            } else {
                deployBtn.innerHTML = '<i class="fa-solid fa-bicycle font-bold mr-2"></i>';
                deployBtn.className = "px-8 py-3 bg-sky-600 text-white font-black mono text-[11px] rounded-xl hover:shadow-[0_0_20px_rgba(14,165,233,0.4)] transition-all";
            }
        }

        // --- BIND ACTION LISTENERS ---
        document.getElementById('saveStatusBtn').onclick = () => this.updateOrderStatus(id);
        deployBtn.onclick = () => this.assignCourier(id);

    } else {
        // ERROR STATE
        document.getElementById('modalItemsList').innerHTML = `
            <div class="p-6 text-center text-rose-500 text-xs italic">
                <i class="fa-solid fa-triangle-exclamation mb-2 block text-xl"></i>
                Uplink Failure: Order details unavailable.
            </div>
        `;
    }
},

  async updateOrderStatus(id) {
    const newStatus = document.getElementById('updateStatusSelect').value;
    const btn = document.getElementById('saveStatusBtn');
    const originalContent = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-[10px]"></i> <span class="text-[9px]">UPDATING...';

    const res = await this.apiRequest(`/admin/orders/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus })
    });

    if (res.status === 'ok') {
        // Visual Success Feedback on Button
        btn.innerHTML = '<i class="fa-solid fa-check text-[10px]"></i> <span class="text-[9px]">SUCCESS';
        btn.classList.replace('bg-orange-500', 'bg-emerald-600');

        // Quietly update the background table
        await this.loadOrders(); 
        
        // Show a quick notification if you have the notify function
        if(this.notify) this.notify(`Order #${id.toString().slice(-6)}: ${newStatus}`);

        // Reset button only (Don't close modal, don't refresh page)
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            btn.classList.replace('bg-emerald-600', 'bg-orange-500');
        }, 2000);
    } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-xmark"></i> FAILED';
        setTimeout(() => btn.innerHTML = originalContent, 2000);
    }
},

async assignCourier(orderId) {
    const riderSelect = document.getElementById('assignRiderSelect');
    const deployBtn = document.getElementById('assignRiderBtn');
    const riderId = riderSelect.value;

    if (!riderId) {
        riderSelect.classList.add('border-rose-500', 'animate-shake');
        setTimeout(() => riderSelect.classList.remove('border-rose-500', 'animate-shake'), 1000);
        return;
    }

    deployBtn.disabled = true;
    deployBtn.innerHTML = `<i class="fa-solid fa-satellite-dish animate-pulse mr-2"></i> UPLINKING...`;

    try {
        const res = await this.apiRequest(`/admin/orders/${orderId}/assign`, {
            method: 'POST',
            body: JSON.stringify({ 
                delivery_guy_id: riderId,
                assigned_at: new Date().toISOString()
            })
        });

        if (res.status === 'ok') {
            // Success Feedback
            deployBtn.innerHTML = `<i class="fa-solid fa-check mr-2"></i> UNIT DEPLOYED`;
            deployBtn.className = "px-8 py-3 bg-emerald-600 text-white font-black mono text-[11px] rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]";
            
            // Refresh main table in background
            await this.loadOrders();

            // DO NOT close modal. Just show it's done.
            if(this.notify) this.notify("Deployment Confirmed");

            // Change button to "Re-assign" style after a delay
            setTimeout(() => {
                deployBtn.disabled = false;
                deployBtn.innerHTML = '<i class="fa-solid fa-redo font-bold mr-2"></i> RE-DEPLOY';
                deployBtn.className = "px-8 py-3 bg-slate-700 text-white font-black mono text-[11px] rounded-xl transition-all";
            }, 3000);

        } else {
            throw new Error(res.message || "Uplink Failed");
        }
    } catch (err) {
        console.error("Tactical Error:", err);
        deployBtn.disabled = false;
        deployBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i> RETRY DEPLOY`;
        deployBtn.classList.replace('bg-sky-600', 'bg-rose-600');
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


// --- INVENTORY EDIT LOGIC ---

UI.editingItemId = null;
UI.getCategoryOptions = function(selectedCategory = "") {
    return ASBEZA_CATEGORIES.map(cat => `
        <option value="${cat}" ${cat === selectedCategory ? 'selected' : ''}>
            ${cat.toUpperCase()}
        </option>
    `).join('');
};
// Function to open modal and load data
// Function to populate the modal with variant image and stock data
UI.editInventoryItem = async function(id) {
    this.editingItemId = id;
    const modal = document.getElementById('editItemModal');
    const variantList = document.getElementById('editVariantsList');
    
    modal.classList.remove('hidden');
    variantList.innerHTML = '<div class="text-center py-4 mono text-[10px] text-orange-500 animate-pulse">SYNCING VARIANTS...</div>';

    const data = await this.apiRequest(`/admin/items/${id}`);
    
    if (data.status === 'ok') {
        document.getElementById('editItemName').value = data.item.name;
        document.getElementById('editItemPrice').value = data.item.base_price;
        document.getElementById('editItemImage').value = data.item.image_url;
        
        // --- NEW: Category Field ---
        // Inside the 'if (data.status === "ok")' block:
        if (document.getElementById('editItemCategory')) {
            // Pass the existing category so it's auto-selected
            document.getElementById('editItemCategory').innerHTML = UI.getCategoryOptions(data.item.category);
        }

        if (data.variants && data.variants.length > 0) {
            variantList.innerHTML = data.variants.map(v => {
                // Calculate margin for display only
                const margin = v.cost_price > 0 
                    ? (((v.price - v.cost_price) / v.cost_price) * 100).toFixed(1) 
                    : 0;

                return `
                <div class="bg-white/5 border border-white/5 p-4 rounded-3xl group/var space-y-3">
                    <div class="flex items-center gap-4">
                        <div class="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 bg-black">
                            <img src="${v.image_url || ''}" onerror="this.src='https://placehold.co/100x100?text=No+Img'" class="w-full h-full object-cover">
                        </div>
                        <div class="flex-1 space-y-1">
                            <label class="text-[8px] mono text-slate-500 uppercase ml-1">Variant Image URL</label>
                            <input type="text" value="${v.image_url || ''}" data-vid="${v.id}" class="v-image w-full bg-black/40 border border-white/5 rounded-lg px-3 py-1.5 text-[10px] text-white focus:border-blue-500 outline-none transition-all">
                        </div>
                        <button onclick="UI.deleteVariant(${v.id}, this)" class="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex-shrink-0">
                            <i class="fa-solid fa-trash-can text-[10px]"></i>
                        </button>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                         <div class="space-y-1">
                            <label class="text-[8px] mono text-slate-500 uppercase ml-1">Variant Name</label>
                            <input type="text" value="${v.name}" data-vid="${v.id}" class="v-name w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[11px] text-white focus:border-blue-500 outline-none transition-all">
                        </div>
                        
                        
                    </div>

                    <div class="grid grid-cols-3 gap-3">
                        <div class="space-y-1">
                            <label class="text-[8px] mono text-emerald-500 uppercase ml-1 font-bold">Cost (Supply)</label>
                            <input type="number" value="${v.cost_price || 0}" data-vid="${v.id}" class="v-cost w-full bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 text-[11px] text-emerald-400 focus:border-emerald-500 outline-none transition-all">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] mono text-orange-500 uppercase ml-1 font-bold">Price (Sale)</label>
                            <input type="number" value="${v.price}" data-vid="${v.id}" class="v-price w-full bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-2 text-[11px] text-orange-400 focus:border-orange-500 outline-none transition-all">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] mono text-slate-500 uppercase ml-1">Margin %</label>
                            <div class="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[11px] text-slate-400">
                                ${margin}%
                            </div>
                        </div>
                    </div>
                </div>
            `;}).join('');
        } else {
            variantList.innerHTML = '<div class="text-center py-10 border-2 border-dashed border-white/5 rounded-3xl text-slate-600 mono text-[10px]">NO VARIANTS AVAILABLE</div>';
        }
    }
};

// Updated Save Logic to include Stock and Image URL
UI.saveItemChanges = async function() {
    const id = this.editingItemId;
    const itemData = {
        name: document.getElementById('editItemName').value,
        base_price: parseFloat(document.getElementById('editItemPrice').value),
        image_url: document.getElementById('editItemImage').value
    };

    // 1. Update the Main Item
    const itemRes = await this.apiRequest(`/admin/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify(itemData)
    });

    // 2. Update all Variants with new fields
    const variantContainers = document.querySelectorAll('#editVariantsList > div');
    const variantPromises = Array.from(variantContainers).map(container => {
        const vId = container.querySelector('.v-name').dataset.vid;
        const vData = {
            name: container.querySelector('.v-name').value,
            price: parseFloat(container.querySelector('.v-price').value),
            stock: parseInt(container.querySelector('.v-stock').value),
            image_url: container.querySelector('.v-image').value
        };
        
        return this.apiRequest(`/admin/variants/${vId}`, {
            method: 'PUT',
            body: JSON.stringify(vData)
        });
    });

    await Promise.all(variantPromises);

    if (itemRes.status === 'ok') {
        this.closeEditModal();
        this.loadInventory();
        // Optional: show a success toast here
    }
};

// Updated Add Logic to include default empty fields
UI.addNewVariant = async function() {
    if (!this.editingItemId) return;
    
    const newVariantData = {
        item_id: this.editingItemId,
        name: "New Variant",
        price: 0,
        cost_price: 0, // Default cost
        stock: 0,
        image_url: ""
    };

    const res = await this.apiRequest(`/asbeza/variants`, {
        method: 'POST',
        body: JSON.stringify(newVariantData)
    });

    if (res.status === 'ok') {
        this.editInventoryItem(this.editingItemId);
    }
};

UI.closeEditModal = function() {
    document.getElementById('editItemModal').classList.add('hidden');
    this.editingItemId = null;
};


// Handle Variant Delete (matches delete_variant_admin)
UI.deleteVariant = async function(variantId, btnElement) {
    if (!confirm('Remove this variant?')) return;
    
    const res = await this.apiRequest(`/admin/variants/${variantId}`, {
        method: 'DELETE'
    });

    if (res.status === 'ok') {
        btnElement.closest('.group\\/var').remove();
        // If it was the last variant, show the "No variants" message
        if (document.getElementById('editVariantsList').children.length === 0) {
            document.getElementById('editVariantsList').innerHTML = '<div class="text-center py-6 border-2 border-dashed border-white/5 rounded-2xl text-slate-600 mono text-[9px]">NO VARIANTS DEFINED</div>';
        }
    }
};
// --- NEW ITEM DEPLOYMENT LOGIC ---

UI.openAddItemModal = function() {
    document.getElementById('addItemForm')?.reset();
    document.getElementById('newVariantsList').innerHTML = '';
    
    // Populate Dropdown
    const categoryDropdown = document.getElementById('newCategory');
    console.log("poupluating the catorgy", UI.getCategoryOptions());
    categoryDropdown.innerHTML = UI.getCategoryOptions();
    console.log("dropdown", categoryDropdown);

    document.getElementById('addItemModal').classList.remove('hidden');
    UI.addNewVariantToForm();
};
// Add a new variant entry (now includes cost_price)
UI.addNewVariantToForm = function() {
  const list = document.getElementById('newVariantsList');
  const div = document.createElement('div');
  div.className = "bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3 variant-entry";
  div.innerHTML = `
    <div class="grid grid-cols-2 gap-2">
      <input type="text" placeholder="Variant Name (e.g. 1kg)" class="v-name bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none">
      <input type="number" step="0.01" placeholder="Price (ETB)" class="v-price bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none">
    </div>
    <div class="grid grid-cols-3 gap-2 items-center">
      <input type="number" step="0.01" placeholder="Cost Price (ETB)" class="v-cost bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none">
      <div class="flex items-center gap-2">
        <input type="url" placeholder="Image URL" class="v-image bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none">
      </div>
      <button type="button" class="v-remove text-[8px] text-rose-500 uppercase font-bold">Remove</button>
    </div>
    <div class="mt-2">
      <img class="v-image-preview w-20 h-20 object-cover rounded-lg hidden border border-white/10" alt="variant preview"/>
    </div>
  `;
  list.appendChild(div);

  // elements
  const priceEl = div.querySelector('.v-price');
  const costEl = div.querySelector('.v-cost');
  const imageEl = div.querySelector('.v-image');
  const previewEl = div.querySelector('.v-image-preview');
  const removeBtn = div.querySelector('.v-remove');

  // wire remove
  removeBtn.addEventListener('click', () => {
    // remove base_price listener if stored
    const basePriceEl = document.getElementById('newBasePrice');
    if (div._baseSync && basePriceEl) basePriceEl.removeEventListener('input', div._baseSync);
    const baseImageEl = document.getElementById('newImage');
    if (div._baseImageSync && baseImageEl) baseImageEl.removeEventListener('input', div._baseImageSync);
    div.remove();
  });

  // auto-fill price from base_price (unless user edited)
  const basePriceEl = document.getElementById('newBasePrice');
  if (basePriceEl && basePriceEl.value) {
    priceEl.value = parseFloat(basePriceEl.value || 0).toFixed(2);
  }
  const syncPrice = () => {
    if (!priceEl.dataset.userEdited) {
      priceEl.value = basePriceEl.value ? parseFloat(basePriceEl.value).toFixed(2) : '';
    }
  };
  if (basePriceEl) {
    basePriceEl.addEventListener('input', syncPrice);
    div._baseSync = syncPrice;
  }
  priceEl.addEventListener('input', () => {
    priceEl.dataset.userEdited = priceEl.value.trim() !== '';
  });

  // auto-fill image_url from item image (newImage) and show live preview
  const baseImageEl = document.getElementById('newImage');
  if (baseImageEl && baseImageEl.value) {
    imageEl.value = baseImageEl.value.trim();
    previewEl.src = baseImageEl.value.trim();
    previewEl.classList.remove('hidden');
  }
  const syncImage = () => {
    if (!imageEl.dataset.userEdited) {
      imageEl.value = baseImageEl.value ? baseImageEl.value.trim() : '';
      if (imageEl.value) {
        previewEl.src = imageEl.value;
        previewEl.classList.remove('hidden');
      } else {
        previewEl.classList.add('hidden');
      }
    }
  };
  if (baseImageEl) {
    baseImageEl.addEventListener('input', syncImage);
    div._baseImageSync = syncImage;
  }
  // when admin types an image URL for the variant, show preview and mark as user-edited
  imageEl.addEventListener('input', () => {
    imageEl.dataset.userEdited = imageEl.value.trim() !== '';
    if (imageEl.value.trim()) {
      previewEl.src = imageEl.value.trim();
      previewEl.classList.remove('hidden');
    } else {
      previewEl.classList.add('hidden');
    }
  });

  // small UX: focus first input
  div.querySelector('.v-name').focus();
};

// Deploy new item (variants include cost_price and image_url; price auto-populated from base_price)
UI.deployNewItem = async function() {
  const btn = document.getElementById('deployBtn');
  const originalText = btn.innerText;

  // Gather variants
  const variantEntries = document.querySelectorAll('.variant-entry');
  const variants = Array.from(variantEntries).map(el => {
    const name = el.querySelector('.v-name').value.trim();
    const price = parseFloat(el.querySelector('.v-price').value || 0);
    const cost_price = parseFloat(el.querySelector('.v-cost').value || 0);
    const image_url = el.querySelector('.v-image').value.trim() || null;
    // backend will accept missing stock; we omit stock from UI as requested
    return { name, price, cost_price, image_url };
  });

  const payload = {
    name: document.getElementById('newName').value.trim(),
    category: document.getElementById('newCategory').value.trim() || 'General',
    base_price: parseFloat(document.getElementById('newBasePrice').value || 0),
    image_url: document.getElementById('newImage').value.trim(),
    // description: document.getElementById('newDesc').value.trim(), // internal description still sent to backend but not shown in variant UI
    variants: variants
  };

  // Basic validation
  if (!payload.name) {
    alert("Please provide an item name.");
    return;
  }
  if (variants.length === 0) {
    alert("Please add at least one variant.");
    return;
  }
  for (const v of variants) {
    if (!v.name) {
      alert("Each variant needs a name.");
      return;
    }
    if (isNaN(v.price) || v.price <= 0) {
      alert("Each variant needs a valid sale price.");
      return;
    }
    // if cost_price is missing or invalid, fallback to price (backend also falls back)
    if (isNaN(v.cost_price) || v.cost_price < 0) v.cost_price = v.price;
    // if image_url missing, fallback to item image (do it here so payload is explicit)
    if (!v.image_url && payload.image_url) v.image_url = payload.image_url;
  }

  // UI feedback
  btn.innerText = "DEPLOYING...";
  btn.disabled = true;

  // send request
  const res = await this.apiRequest('/admin/add_items', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (res && res.status === 'ok') {
    btn.innerText = "SUCCESS!";
    setTimeout(() => {
      document.getElementById('addItemModal').classList.add('hidden');
      if (typeof this.loadInventory === 'function') this.loadInventory();
      btn.innerText = originalText;
      btn.disabled = false;
    }, 1000);
  } else {
    alert("Error: " + (res?.message || 'Unknown error'));
    btn.innerText = originalText;
    btn.disabled = false;
  }
};


// Global Exposure
window.openAddItemModal = () => UI.openAddItemModal();
window.UI = UI;
window.closeUserModal = () => document.getElementById('userModal').classList.add('hidden');
UI.init();

