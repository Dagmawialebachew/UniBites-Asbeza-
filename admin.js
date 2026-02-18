/** * UniBites Admin - Core Engine v2.1
 * Fully Dynamic Integration with Aiohttp Backend
 */

const API_BASE = "https://deliveraau.onrender.com/api";
let chartInstance = null;

const UI = {
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

    // Helper for Authorized Requests
    async apiRequest(endpoint, options = {}) {
        const token = localStorage.getItem('admin_token');
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        
        if (res.status === 401) this.logout(); // Auto-logout on expired/invalid session
        return await res.json();
    },

    checkAuth() {
    const token = localStorage.getItem('admin_token');
    if (token) {
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('adminContent').classList.remove('hidden');

        // Restore last view or default to analytics
        const lastView = localStorage.getItem('current_view') || 'analytics';
        this.switchView(lastView);
    }
},

    async handleLogin() {
        const user = document.getElementById('adminUser').value;
        const pass = document.getElementById('adminPass').value;
        const btn = document.getElementById('loginBtn');
        
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        
        try {
            const res = await fetch(`${API_BASE}/admin/login`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username: user, password: pass})
            });
            const data = await res.json();
            
            if (data.status === 'ok') {
                localStorage.setItem('admin_token', data.token);
                location.reload();
            } else {
                this.showError();
            }
        } catch (e) { this.showError(); }
        btn.textContent = 'Authorize';
    },

    showError() {
        const err = document.getElementById('loginError');
        err.classList.remove('hidden');
        setTimeout(() => err.classList.add('hidden'), 3000);
    },

    async switchView(viewId) {
    // Hide all sections
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`${viewId}View`).classList.remove('hidden');

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.view === viewId);
        l.classList.toggle('text-slate-400', l.dataset.view !== viewId);
    });

    // Update title
    document.getElementById('viewTitle').textContent = `Mission: ${viewId}`;

    // Save current view
    localStorage.setItem('current_view', viewId);

    // Dynamic loading
    if (viewId === 'analytics') this.loadDashboardData();
    if (viewId === 'orders') this.loadOrders();
    if (viewId === 'grocery') this.loadInventory();
},

    async loadDashboardData() {
    const stats = await this.apiRequest('/admin/stats'); // make sure path matches backend
    if (stats.status === 'ok') {
        await this.updateQuickStats(stats);
        this.renderTrendChart(stats.trend);
    }
},

    async updateQuickStats(stats) {
        // Revenue from trend
        const totalRevenue = stats.trend.reduce((sum, day) => sum + parseFloat(day.total), 0);

        const elements = {
            revenue: document.getElementById("statRevenue"),
            items: document.getElementById("statItems")
        };

        if (elements.revenue) elements.revenue.textContent = totalRevenue.toLocaleString();
        if (elements.items) elements.items.textContent = stats.top_selling.length;

        // Now fetch orders separately
        const ordersData = await this.apiRequest('/admin/orders');
        if (ordersData.status === 'ok') {
            const pending = ordersData.orders.filter(o => o.status.toLowerCase() === 'pending').length;
            if (document.getElementById('statPending')) {
                document.getElementById('statPending').textContent = pending;
            }
        }
    },


    renderTrendChart(trendData) {
        const ctx = document.getElementById('orderTrendChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        // Extract labels (dates) and data (totals) from your Python backend response
        const labels = trendData.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString([], { weekday: 'short' });
        });
        const points = trendData.map(d => d.total);

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue',
                    data: points,
                    borderColor: '#FF7A00',
                    borderWidth: 4,
                    pointBackgroundColor: '#FF7A00',
                    backgroundColor: 'rgba(255, 122, 0, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#64748b' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } }
                }
            }
        });
    },

    async loadInventory() {
        const list = document.getElementById('inventoryList');
        list.innerHTML = `<tr><td colspan="4" class="p-20 text-center mono animate-pulse text-orange-500 text-xs">SCANNING STORAGE...</td></tr>`;
        
        // Note: You need a GET /admin/items endpoint in Python
        const data = await this.apiRequest('/asbeza/items'); 
        console.log("Inventory Data:", data);
        
        if (data.items) {
            list.innerHTML = data.items.map(item => `
                <tr class="hover:bg-white/[0.02] transition-colors border-b border-white/5">
                    <td class="p-6">
                        <div class="flex items-center gap-4">
<img src="${item.image_url || ''}" class="w-12 h-12 rounded-xl object-cover border border-white/10">                            <div>
                                <div class="text-sm font-bold text-white uppercase">${item.name}</div>
                                <div class="text-[9px] mono text-slate-500 uppercase">UID: ${item.id}</div>
                            </div>
                        </div>
                    </td>
                    <td class="p-6 mono text-white text-sm">${item.base_price} ETB</td>
                    <td class="p-6">
                        <span class="px-3 py-1 rounded-full bg-white/5 text-[9px] mono text-slate-400">
                            ${item.variant_count || 0} ACTIVE VARIANTS
                        </span>
                    </td>
                    <td class="p-6 text-right">
                        <button class="text-slate-500 hover:text-orange-500 transition-colors mr-4"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="text-slate-500 hover:text-red-500 transition-colors"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        }
    },

    async handleAddItem() {
        // Example logic to collect data for your add_item Python endpoint
        const productData = {
            name: document.getElementById('itemName').value,
            description: document.getElementById('itemDesc').value,
            base_price: parseFloat(document.getElementById('itemPrice').value),
            image_url: document.getElementById('itemImg').value,
            variants: [
                { name: "Small", price: 100, stock: 50 },
                { name: "Large", price: 180, stock: 30 }
            ]
        };

        const res = await this.apiRequest('/admin/add_item', {
            method: 'POST',
            body: JSON.stringify(productData)
        });

        if (res.status === 'ok') {
            alert("Product Deployed!");
            this.loadInventory();
        }
    },

    async loadOrders() {
        const list = document.getElementById('orderList');
        list.innerHTML = `<tr><td colspan="5" class="p-20 text-center mono animate-pulse text-orange-500 text-xs">UPLINKING TO CORE...</td></tr>`;
        
        const data = await this.apiRequest('/admin/orders');
        
        if (data.status === 'ok') {
            // Update Pending Stat on the fly
            this.currentOrders = data.orders;
            const pending = data.orders.filter(o => o.status.toLowerCase() === 'pending').length;
            if (document.getElementById('statPending')) {
                document.getElementById('statPending').textContent = pending;
            }

            list.innerHTML = data.orders.map(o => `
                <tr class="hover:bg-white/[0.02] transition-colors group border-b border-white/5">
                    <td class="p-8 font-bold mono text-xs text-white">#${o.id.toString().slice(-6)}</td>
                    <td class="p-8">
                        <div class="text-sm font-bold text-white uppercase italic">User_${o.user_id}</div>
                        <div class="text-[9px] mono text-slate-500 uppercase">${o.payment_method || 'Standard'}</div>
                    </td>
                    <td class="p-8 font-black text-orange-500">${o.total_price} ETB</td>
                    <td class="p-8">
                        <span class="px-3 py-1 rounded-lg text-[9px] mono uppercase font-black status-${o.status.toLowerCase()}">
                            ${o.status}
                        </span>
                    </td>
                    <td class="p-8 text-right">
                        <button onclick="UI.viewOrderDetails(${o.id})" class="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] mono hover:bg-orange-500 hover:text-black transition-all">
                            DETAILS
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    },

    async viewOrderDetails(id) {
        // 1. Show loading state if you want, or just fetch
        const data = await this.apiRequest(`/admin/orders/${id}`);
        
        // We also need the base order info (status, date, proof) 
        // usually found in your main order list
        const orderSummary = this.currentOrders.find(o => o.id === id);

        if (data.status === 'ok' && orderSummary) {
            // Fill Header
            document.getElementById('modalOrderId').textContent = `#${orderSummary.id.toString().slice(-6)}`;
            document.getElementById('modalOrderDate').textContent = new Date(orderSummary.created_at).toLocaleString();
            
            // Set Status Selector
            document.getElementById('updateStatusSelect').value = orderSummary.status.toLowerCase();
            
            // Render Items
            const itemsList = document.getElementById('modalItemsList');
            itemsList.innerHTML = data.items.map(item => `
                <div class="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <div class="flex items-center gap-3">
                        <div class="text-orange-500 font-black mono text-xs">${item.quantity}x</div>
                        <div>
                            <div class="text-[11px] font-bold uppercase tracking-tight">${item.item_name}</div>
                            <div class="text-[9px] mono text-slate-500">${item.variant_name}</div>
                        </div>
                    </div>
                    <div class="text-[10px] mono font-bold">${item.price * item.quantity} ETB</div>
                </div>
            `).join('');

            // Set Proof Image
            const proofImg = document.getElementById('modalProofImg');
            proofImg.src = orderSummary.payment_proof_url || "https://placehold.co/400x600?text=No+Receipt+Uploaded";
            proofImg.onclick = () => window.open(proofImg.src, '_blank');

            // Handle Save Button
            document.getElementById('saveStatusBtn').onclick = () => this.updateOrderStatus(id);

            // Open Modal
            document.getElementById('orderModal').classList.remove('hidden');
        }
    },

    async updateOrderStatus(id) {
        const newStatus = document.getElementById('updateStatusSelect').value;
        const btn = document.getElementById('saveStatusBtn');
        
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> UPDATING';
        
        // Note: You need this endpoint in Python
        const res = await this.apiRequest(`/admin/orders/${id}/status`, {
            method: 'POST',
            body: JSON.stringify({ status: newStatus })
        });

        if (res.status === 'ok') {
            btn.textContent = 'SUCCESS';
            btn.classList.replace('bg-orange-500', 'bg-emerald-500');
            setTimeout(() => {
                this.closeModal();
                this.loadOrders(); // Refresh list
                btn.classList.replace('bg-emerald-500', 'bg-orange-500');
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




window.UI = UI; 
UI.init();