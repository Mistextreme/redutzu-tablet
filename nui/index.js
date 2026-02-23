const date = new Date();

const app = new Vue({
    el: '#tablet',
    data: {
        opened: false,
        currentPage: 'main',

        Calendar: {
            day: date.toLocaleDateString('en-US', { 
                weekday: 'long' 
            }),
            date: date.getDate()
        }, 

        Crypto: [
            { name: 'Bitcoin',    icon: 'img/btc.svg',  description: 'Your gateway to Bitcoin & beyond' }, 
            { name: 'Ethereum',   icon: 'img/eth.svg',  description: 'The tech is new and ever-evolving' }, 
            { name: 'Avalanche',  icon: 'img/avax.svg', description: 'Blazingly Fast, Low Cost & Eco-Friendly' }
        ],

        Applications: [
            { name: 'Information', icon: 'img/info.svg',     href: 'info'     }, 
            { name: 'Controls',    icon: 'img/controls.svg', href: 'keybinds' },
            { name: 'Browser',     icon: 'img/browser.svg',  href: 'browser'  }
        ],

        // ── Browser App State ─────────────────────────────────────────────────
        browser: {
            menuItems:     [],          // Loaded from data/links.json via NUI
            currentUrl:    '',          // Currently loaded URL
            loading:       false,       // Iframe loading state
            expanded:      true,        // Sidebar expanded / collapsed
            settingsOpen:  false,       // Settings modal visibility
            editingItems:  [],          // Working copy used inside the settings modal
            linksLoaded:   false,       // Guard: only fetch from server once per session
            activeItemId:  null,        // Tracks which sidebar item is currently active

            availableIcons: [
                'fa-home',
                'fa-link',
                'fa-star',
                'fa-heart',
                'fa-user',
                'fa-bell',
                'fa-envelope',
                'fa-image',
                'fa-music',
                'fa-circle-info',
                'fa-chart-pie',
                'fa-calendar-days',
                'fa-sliders',
                'fa-table-columns',
                'fa-cog',
                'fa-globe',
                'fa-newspaper',
                'fa-gamepad',
                'fa-film',
                'fa-shop'
            ]
        }
        // ─────────────────────────────────────────────────────────────────────
    },

    mounted() {
        // Set initial page opacity
        let initial = document.getElementById(this.currentPage);
        if (initial) initial.style.opacity = 1;
    },

    watch: {
        // Load links from the server the first time the browser page is opened
        currentPage(newPage) {
            if (newPage === 'browser' && !this.browser.linksLoaded) {
                this.browserLoadLinks();
            }
        }
    },

    methods: {
        // ── Core NUI helper ──────────────────────────────────────────────────
        async post(url, data = {}) {
            const response = await fetch(`https://${GetParentResourceName()}/${url}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        },

        // ── Page switching ────────────────────────────────────────────────────
        setPageOpacity(id, value) {
            let page = document.getElementById(id);
            if (page) page.style.opacity = value;
        },

        async switchPage(page) {
            if (this.currentPage === page) return;
            this.setPageOpacity(this.currentPage, 0);
            this.currentPage = page;
            setTimeout(() => {
                this.setPageOpacity(page, 1);
            }, 50);
        },

        // ── Browser: Load links from data/links.json via Lua ─────────────────
        async browserLoadLinks() {
            try {
                const response = await fetch(`https://${GetParentResourceName()}/getLinks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const jsonText = await response.json(); // cb() sends a Lua string, json-encoded
                const items = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
                this.browser.menuItems = Array.isArray(items) ? items : [];
                this.browser.linksLoaded = true;
            } catch (err) {
                console.error('[Browser] Failed to load links:', err);
                this.browser.menuItems = [];
                this.browser.linksLoaded = true;
            }
        },

        // ── Browser: Persist links to data/links.json via Lua + server ───────
        async browserPersistLinks(items) {
            try {
                await fetch(`https://${GetParentResourceName()}/saveLinks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(items)
                });
            } catch (err) {
                console.error('[Browser] Failed to save links:', err);
            }
        },

        // ── Browser: Handle menu item click ───────────────────────────────────
        browserHandleMenuClick(id) {
            this.browser.activeItemId = id;
            this.browser.menuItems.forEach(item => {
                item.active = (item.id === id);
            });
            const selected = this.browser.menuItems.find(i => i.id === id);
            if (selected) {
                this.browserLoadContent(selected.url);
            }
        },

        // ── Browser: Load URL into the iframe ────────────────────────────────
        browserLoadContent(url) {
            const iframe = document.getElementById('browserFrame');
            if (!iframe) return;

            this.browser.loading    = true;
            this.browser.currentUrl = url;

            iframe.src = url;

            // Hide loader once the iframe fires its load event
            iframe.onload = () => {
                this.browser.loading = false;
            };
        },

        // ── Browser: Open settings modal (create working copy) ────────────────
        browserOpenSettings() {
            // Deep-copy menu items into editingItems so changes are non-destructive
            this.browser.editingItems = this.browser.menuItems.map(item => ({ ...item }));
            this.browser.settingsOpen = true;
        },

        // ── Browser: Close settings modal (discard changes) ───────────────────
        browserCloseSettings() {
            this.browser.settingsOpen = false;
            this.browser.editingItems = [];
        },

        // ── Browser: Add a blank menu item inside the settings modal ──────────
        browserAddMenuItem() {
            this.browser.editingItems.push({
                id:     Date.now(),
                title:  'New Link',
                icon:   'fa-link',
                url:    'https://',
                active: false
            });
        },

        // ── Browser: Remove a menu item inside the settings modal ─────────────
        browserRemoveMenuItem(id) {
            if (this.browser.editingItems.length <= 1) {
                alert('You must keep at least one link.');
                return;
            }
            this.browser.editingItems = this.browser.editingItems.filter(i => i.id !== id);
        },

        // ── Browser: Confirm and save all changes ─────────────────────────────
        async browserSaveSettings() {
            // FIX: Save which item was active BEFORE committing the new list,
            // so we can restore the active state after the server round-trip.
            // Previously this was dead code — all items were set to active:false
            // and then the code tried to find an active item, which could never exist.
            const previousActiveId = this.browser.activeItemId;

            // Commit the working copy to the real state.
            // All items start as inactive; active state is restored below.
            this.browser.menuItems = this.browser.editingItems.map(item => ({
                ...item,
                active: item.id === previousActiveId
            }));

            this.browser.settingsOpen = false;
            this.browser.editingItems = [];

            // Persist to server (linksUpdated reply will sync menuItems again,
            // so we restore activeItemId so the watcher can re-apply active state)
            await this.browserPersistLinks(this.browser.menuItems);
        },

        // ── Browser: Re-apply active state after server sync ──────────────────
        // Called internally after linksUpdated to keep sidebar in sync
        browserRestoreActiveState(items) {
            const id = this.browser.activeItemId;
            return items.map(item => ({ ...item, active: item.id === id }));
        }
    }
});

// ── NUI message listener ──────────────────────────────────────────────────────
window.addEventListener('message', async ({ data }) => {
    switch (data.action) {
        case 'open':
            app.opened = true;
            break;

        case 'close':
            app.opened = false;
            break;

        // Server confirmed the save and sends back the clean JSON.
        // We restore the active state because the server strips it
        // (json.encode re-serializes all items with active: false/true as saved).
        case 'linksUpdated':
            try {
                const raw = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
                if (Array.isArray(raw)) {
                    app.browser.menuItems = app.browserRestoreActiveState(raw);
                }
            } catch (e) {
                console.error('[Browser] linksUpdated parse error:', e);
            }
            break;
    }
});

// ── Escape key closes tablet ──────────────────────────────────────────────────
window.addEventListener('keydown', async ({ key }) => {
    if (key.toLowerCase() === 'escape') {
        // If the browser settings modal is open, close it instead of closing the tablet
        if (app.browser.settingsOpen) {
            app.browserCloseSettings();
            return;
        }
        await app.post('close');
    }
});