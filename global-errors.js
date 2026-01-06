// Catch all JS errors
window.addEventListener('error', e => {
    console.error('Global error:', e.error);
    if (window.showToast && !String(e.message).includes('Script error')) {
        showToast('An unexpected error occurred. Please refresh the page.', 'danger', 6000);
    }
});

// Catch unhandled Promise rejections (like Firebase errors not caught)
window.addEventListener('unhandledrejection', e => {
    console.error('Unhandled promise rejection:', e.reason);
    window.showToast?.('Something went wrong. Please try again.', 'danger', 5000);
});
