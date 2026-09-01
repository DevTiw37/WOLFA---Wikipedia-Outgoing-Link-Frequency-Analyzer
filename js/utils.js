/**
 * Utility helper functions for WikiLink Frequency Analyzer.
 */
(function (global) {
    'use strict';

    /**
     * Escapes HTML characters to prevent XSS injection.
     * @param {*} str 
     * @returns {string}
     */
    function escapeHtml(str) {
        if (str === undefined || str === null) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Trigger a download of dynamic content as a local file.
     * @param {string|Blob} content 
     * @param {string} fileName 
     * @param {string} mimeType 
     */
    function downloadFile(content, fileName, mimeType) {
        const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Fallback-safe clipboard copier supporting file:// and non-HTTPS contexts.
     * @param {string} text 
     */
    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback clipboard copy failed:', err);
        }
        document.body.removeChild(textArea);
    }

    /**
     * Triggers a global Toast Notification in the UI.
     * @param {string} msg 
     */
    let toastTimeout = null;
    function showToast(msg) {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toastMsg');
        if (!toast || !toastMsg) return;
        
        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }

        toastMsg.textContent = msg;
        toast.classList.remove('translate-y-20', 'opacity-0');
        toastTimeout = setTimeout(() => {
            toast.classList.add('translate-y-20', 'opacity-0');
            toastTimeout = null;
        }, 3000);
    }

    const utils = {
        escapeHtml: escapeHtml,
        downloadFile: downloadFile,
        copyToClipboard: copyToClipboard,
        showToast: showToast
    };

    global.WikiApp = global.WikiApp || {};
    global.WikiApp.utils = utils;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = utils;
    }
})(typeof window !== 'undefined' ? window : globalThis);

