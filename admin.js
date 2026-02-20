/** * UniBites Admin - Core Engine v3.0
 * Fully Dynamic Integration with Aiohttp Backend
 */

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
  // Show modal immediately with skeleton/loading placeholders
  document.getElementById('orderModal').classList.remove('hidden');
  document.getElementById('modalOrderId').textContent = `#${id.toString().slice(-6)}`;
  document.getElementById('modalOrderDate').textContent = 'Loading...';
  document.getElementById('modalItemsList').innerHTML = `
    <div class="flex justify-center p-6 text-slate-400 text-xs">
      <i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Fetching order details...
    </div>
  `;

  // Fetch data
  const data = await this.apiRequest(`/admin/orders/${id}`);
  const summary = this.currentOrders.find(o => o.id === id);

  if (data.status === 'ok' && summary) {
    // Update header
    const created = new Date(summary.created_at);
    const now = new Date();
    const diffSec = Math.floor((now - created) / 1000);
    const agoText = diffSec < 60 ? `${diffSec}s ago` :
                    diffSec < 3600 ? `${Math.floor(diffSec/60)}m ago` :
                    diffSec < 86400 ? `${Math.floor(diffSec/3600)}h ago` :
                    `${Math.floor(diffSec/86400)}d ago`;

    document.getElementById('modalOrderDate').textContent =
      `${created.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} (${agoText})`;

    // Status select
    document.getElementById('updateStatusSelect').value = summary.status.toLowerCase();

    // Items
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

    // Proof
    const proofImg = document.getElementById('modalProofImg');
    proofImg.src = summary.payment_proof_url || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQsQs4bxz22n2D6_LPXQhADYVe2u3bXTrYrxw&s";

    // Summary
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

    // User
    if (data.user) {
      document.getElementById('modalUserTelegram').innerHTML = `<span class="text-sky-400">@${data.user.telegram_id || 'hidden'}</span>`;
      document.getElementById('modalUserName').textContent = data.user.full_name || data.user.first_name || "Guest User";
      document.getElementById('modalUserPhone').textContent = data.user.phone || "N/A";
      document.getElementById('modalUserCampus').innerHTML = `<span class="px-2 py-0.5 rounded bg-white/10 text-[10px]">${data.user.campus || "N/A"}</span>`;
    }

    // Bind
    document.getElementById('saveStatusBtn').onclick = () => this.updateOrderStatus(id);
  } else {
    document.getElementById('modalItemsList').innerHTML = `<div class="p-6 text-center text-rose-500 text-xs">Failed to load order details.</div>`;
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


// --- INVENTORY EDIT LOGIC ---

UI.editingItemId = null;

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

        if (data.variants && data.variants.length > 0) {
            variantList.innerHTML = data.variants.map(v => `
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

                    <div class="grid grid-cols-3 gap-3">
                        <div class="space-y-1">
                            <label class="text-[8px] mono text-slate-500 uppercase ml-1">Name</label>
                            <input type="text" value="${v.name}" data-vid="${v.id}" class="v-name w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[11px] text-white focus:border-blue-500 outline-none transition-all">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] mono text-slate-500 uppercase ml-1">Price (ETB)</label>
                            <input type="number" value="${v.price}" data-vid="${v.id}" class="v-price w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[11px] text-white focus:border-blue-500 outline-none transition-all">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] mono text-slate-500 uppercase ml-1">Stock Qty</label>
                            <input type="number" value="${v.stock || 0}" data-vid="${v.id}" class="v-stock w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[11px] text-white focus:border-blue-500 outline-none transition-all">
                        </div>
                    </div>
                </div>
            `).join('');
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



// Global Exposure
window.UI = UI;
window.closeUserModal = () => document.getElementById('userModal').classList.add('hidden');
UI.init();

