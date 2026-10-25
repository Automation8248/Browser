let tabs = typeof initialTabs !== 'undefined' ? initialTabs : [];

function renderTabs() {
    const container = document.getElementById('tabs-container');
    const viewports = document.getElementById('viewport-container');
    container.innerHTML = '';
    
    tabs.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
        tabEl.onclick = () => switchTab(tab.id);
        tabEl.innerHTML = `<span>${tab.title}</span> <button class="close-tab" onclick="closeTab(event, '${tab.id}')">×</button>`;
        container.appendChild(tabEl);

        let iframe = document.getElementById(`frame-${tab.id}`);
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = `frame-${tab.id}`;
            iframe.src = tab.url;
            viewports.appendChild(iframe);
        }
        iframe.className = tab.id === activeTabId ? 'active' : '';
    });

    const activeTabData = tabs.find(t => t.id === activeTabId);
    if (activeTabData) {
        document.getElementById('url-input').value = activeTabData.url;
    }
    
    saveState();
}

function switchTab(id) {
    activeTabId = id;
    renderTabs();
}

function addTab() {
    const newId = 'tab-' + Date.now();
    tabs.push({ id: newId, url: 'https://www.bing.com', title: 'New Tab' });
    activeTabId = newId;
    renderTabs();
}

function closeTab(event, id) {
    event.stopPropagation();
    tabs = tabs.filter(t => t.id !== id);
    if (tabs.length === 0) addTab();
    else if (activeTabId === id) activeTabId = tabs[tabs.length - 1].id;
    const iframe = document.getElementById(`frame-${id}`);
    if (iframe) iframe.remove();
    renderTabs();
}

function loadUrl() {
    let url = document.getElementById('url-input').value;
    if (!url.startsWith('http')) url = 'https://' + url;
    
    const activeIndex = tabs.findIndex(t => t.id === activeTabId);
    if (activeIndex !== -1) {
        tabs[activeIndex].url = url;
        tabs[activeIndex].title = url;
        document.getElementById(`frame-${activeTabId}`).src = url;
        saveState();
    }
}

function handleUrlEnter(e) { if (e.key === 'Enter') loadUrl(); }
function refreshFrame() { document.getElementById(`frame-${activeTabId}`).src = document.getElementById(`frame-${activeTabId}`).src; }

function saveState() {
    fetch('/save_state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabs_data: JSON.stringify(tabs), active_tab: activeTabId })
    });
}

window.onload = () => {
    if (tabs.length === 0) addTab();
    else renderTabs();
};
