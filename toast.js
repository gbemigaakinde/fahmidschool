window.showToast = function (message, type = 'info', duration = 5000) {
    let container = document.getElementById('toast-container');

    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '12px';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.pointerEvents = 'auto';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '12px';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.minWidth = '250px';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.background = 'white';
    toast.style.color = '#333';
    toast.style.borderLeft = '4px solid';
    toast.style.transform = 'translateX(400px)';
    toast.style.opacity = '0';
    toast.style.transition = 'transform 0.3s ease, opacity 0.3s ease';

    // Toast type colors
    const colors = {
        success: { bg: '#f1f8f4', color: '#2e7d32', border: '#4caf50' },
        danger: { bg: '#fef2f2', color: '#c62828', border: '#f44336' },
        warning: { bg: '#fff9f0', color: '#e65100', border: '#ff9800' },
        info: { bg: '#f0f8ff', color: '#1565c0', border: '#2196F3' }
    };

    if (colors[type]) {
        toast.style.background = colors[type].bg;
        toast.style.color = colors[type].color;
        toast.style.borderLeftColor = colors[type].border;
    }

    // Optional icons
    const icons = {
        success: '✓',
        danger: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    if (icons[type]) {
        const icon = document.createElement('span');
        icon.textContent = icons[type] + ' ';
        icon.style.fontSize = '1.2em';
        toast.appendChild(icon);
    }

    toast.appendChild(document.createTextNode(message));
    container.appendChild(toast);

    requestAnimationFrame(() => toast.style.transform = 'translateX(0)');
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.transform = 'translateX(400px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
};
