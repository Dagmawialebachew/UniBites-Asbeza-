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
            this.switchView('analytics');
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
        document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
        document.getElementById(`${viewId}View`).classList.remove('hidden');

        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.toggle('active', l.dataset.view === viewId);
            l.classList.toggle('text-slate-400', l.dataset.view !== viewId);
        });

        document.getElementById('viewTitle').textContent = `Mission: ${viewId}`;

        // Dynamic Loading based on View
        if (viewId === 'analytics') this.loadDashboardData();
        if (viewId === 'orders') this.loadOrders();
    },

    async loadDashboardData() {
        const data = await this.apiRequest('/admin/stats');
        if (data.status === 'ok') {
            this.updateQuickStats(data);
            this.renderTrendChart(data.trend);
        }
    },

    updateQuickStats(data) {
        // Revenue from trend
        const totalRevenue = data.trend.reduce((sum, day) => sum + parseFloat(day.total), 0);
        
        const elements = {
            revenue: document.getElementById("statRevenue"),
            items: document.getElementById("statItems")
        };

        if (elements.revenue) elements.revenue.textContent = totalRevenue.toLocaleString();
        // Assuming top_selling length as a proxy for 'total types' or update via item list
        if (elements.items) elements.items.textContent = data.top_selling.length;
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

    async loadOrders() {
        const list = document.getElementById('orderList');
        list.innerHTML = `<tr><td colspan="5" class="p-20 text-center mono animate-pulse text-orange-500 text-xs">UPLINKING TO CORE...</td></tr>`;
        
        const data = await this.apiRequest('/admin/orders');
        
        if (data.status === 'ok') {
            // Update Pending Stat on the fly
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
        console.log("Fetching manifest for:", id);
        const data = await this.apiRequest(`/admin/orders/${id}`);
        if (data.status === 'ok') {
            // Add your modal opening logic here
            alert(`Order contains ${data.items.length} items. View console for Manifest.`);
            console.table(data.items);
        }
    },

    logout() {
        localStorage.removeItem('admin_token');
        location.reload();
    }
};

UI.init();