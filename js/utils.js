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
        if (typeof document === 'undefined') return;
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

    /**
     * Format an ISO date string into human-friendly relative time (e.g. "Just now", "5m ago", "2h ago", "Yesterday")
     * @param {string} isoString 
     * @returns {string}
     */
    function formatTimeAgo(isoString) {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            const now = new Date();
            const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

            if (diffSec < 45) return 'Just now';
            if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
            if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
            if (diffSec < 172800) return 'Yesterday';
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch (e) {
            return '';
        }
    }

    // --- LocalStorage Keys ---
    const STORAGE_KEY_SESSIONS = 'wolfa_history_sessions_v1';
    const STORAGE_KEY_CACHE = 'wolfa_article_cache_v1';
    const MAX_SESSIONS = 60;
    const MAX_CACHED_ARTICLES = 80;

    /**
     * Retrieve all saved analysis sessions from localStorage
     * @returns {Array<Object>}
     */
    function getSavedSessions() {
        try {
            if (typeof localStorage === 'undefined') return [];
            const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn('Could not read saved sessions from localStorage:', e);
            return [];
        }
    }

    /**
     * Save or update an analysis session in localStorage
     * @param {Object} session 
     */
    function saveSessionToHistory(session) {
        if (!session || !session.title) return;
        try {
            if (typeof localStorage === 'undefined') return;
            let sessions = getSavedSessions();

            // Unique ID based on root title & lang
            const id = session.id || `${session.lang || 'en'}_${session.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

            // Clean previous duplicates for the same root title/lang
            sessions = sessions.filter(s => s.id !== id);

            const sessionEntry = {
                id: id,
                title: session.title,
                lang: session.lang || 'en',
                updatedAt: new Date().toISOString(),
                trail: Array.isArray(session.trail) ? session.trail : [session.title],
                history: Array.isArray(session.history) ? session.history : [],
                currentIndex: typeof session.currentIndex === 'number' ? session.currentIndex : (session.history?.length ? session.history.length - 1 : 0),
                totalUnique: session.totalUnique || (session.links ? session.links.length : 0),
                totalOccurrences: session.totalOccurrences || 0
            };

            // Prepend latest session
            sessions.unshift(sessionEntry);

            // Cap at MAX_SESSIONS
            if (sessions.length > MAX_SESSIONS) {
                sessions = sessions.slice(0, MAX_SESSIONS);
            }

            localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
        } catch (e) {
            console.warn('Could not save session to localStorage (quota exceeded?):', e);
        }
    }

    /**
     * Delete a single session by ID
     * @param {string} sessionId 
     */
    function deleteSessionFromHistory(sessionId) {
        try {
            if (typeof localStorage === 'undefined') return;
            let sessions = getSavedSessions();
            sessions = sessions.filter(s => s.id !== sessionId);
            localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
        } catch (e) {
            console.warn('Could not delete session from localStorage:', e);
        }
    }

    /**
     * Clear all saved history sessions
     */
    function clearAllSessions() {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.removeItem(STORAGE_KEY_SESSIONS);
        } catch (e) {
            console.warn('Could not clear sessions from localStorage:', e);
        }
    }

    /**
     * Retrieve persisted article cache map from localStorage
     * @returns {Object}
     */
    function getPersistedArticleCache() {
        try {
            if (typeof localStorage === 'undefined') return {};
            const raw = localStorage.getItem(STORAGE_KEY_CACHE);
            if (!raw) return {};
            return JSON.parse(raw) || {};
        } catch (e) {
            return {};
        }
    }

    /**
     * Persist an article result to localStorage cache
     * @param {string} key 
     * @param {Object} articleData 
     */
    function persistArticleToCache(key, articleData) {
        if (!key || !articleData) return;
        try {
            if (typeof localStorage === 'undefined') return;
            let cache = getPersistedArticleCache();
            cache[key] = articleData;

            // Trim keys if too large
            const keys = Object.keys(cache);
            if (keys.length > MAX_CACHED_ARTICLES) {
                const trimmed = {};
                keys.slice(keys.length - MAX_CACHED_ARTICLES).forEach(k => {
                    trimmed[k] = cache[k];
                });
                cache = trimmed;
            }

            localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(cache));
        } catch (e) {
            // Quota reached, ignore silently
        }
    }

    /**
     * Exports an entire drill path session as a structured downloadable JSON file.
     * @param {Object} sessionData 
     */
    function exportSessionAsJsonFile(sessionData) {
        if (!sessionData) return;
        const safeTitle = (sessionData.title || 'session').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${safeTitle}_drill_session.json`;

        const exportPayload = {
            format: 'WOLFA_SESSION_EXPORT',
            version: '2.0',
            exportedAt: new Date().toISOString(),
            rootArticle: sessionData.title,
            lang: sessionData.lang || 'en',
            drillTrail: sessionData.trail || [],
            currentIndex: sessionData.currentIndex || 0,
            history: sessionData.history || [],
            clusterNetwork: sessionData.clusterNetwork || null
        };

        const jsonStr = JSON.stringify(exportPayload, null, 2);
        downloadFile(jsonStr, filename, 'application/json');
    }

    /**
     * Validates and parses an imported session JSON string.
     * @param {string} jsonStr 
     * @returns {Object} Parsed session object
     */
    function parseSessionJson(jsonStr) {
        if (!jsonStr || typeof jsonStr !== 'string') {
            throw new Error('Invalid or empty file content.');
        }

        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        } catch (e) {
            throw new Error('File is not a valid JSON document.');
        }

        // Support both WOLFA_SESSION_EXPORT format and single article export format
        if (parsed.format === 'WOLFA_SESSION_EXPORT') {
            if (!Array.isArray(parsed.history) || parsed.history.length === 0) {
                throw new Error('Session file does not contain valid history items.');
            }
            return {
                title: parsed.rootArticle || parsed.history[0]?.title,
                lang: parsed.lang || parsed.history[0]?.lang || 'en',
                history: parsed.history,
                currentIndex: typeof parsed.currentIndex === 'number' ? parsed.currentIndex : parsed.history.length - 1,
                trail: parsed.drillTrail || parsed.history.map(h => h.title),
                clusterNetwork: parsed.clusterNetwork || null
            };
        }

        // Legacy / Standard Single-Article Export format support
        if (parsed.sourceArticle && Array.isArray(parsed.links)) {
            const singleArticle = {
                title: parsed.sourceArticle,
                lang: parsed.language || 'en',
                links: parsed.links,
                totalUnique: parsed.totalUniqueLinks || parsed.links.length,
                totalOccurrences: parsed.totalOccurrences || parsed.links.reduce((a, c) => a + (c.count || 1), 0),
                analyzedAt: parsed.analyzedAt || new Date().toISOString()
            };
            return {
                title: singleArticle.title,
                lang: singleArticle.lang,
                history: [singleArticle],
                currentIndex: 0,
                trail: [singleArticle.title],
                clusterNetwork: null
            };
        }

        throw new Error('Unrecognized session file format. Please upload a valid WOLFA session file.');
    }

    const utils = {
        escapeHtml: escapeHtml,
        downloadFile: downloadFile,
        copyToClipboard: copyToClipboard,
        showToast: showToast,
        formatTimeAgo: formatTimeAgo,
        getSavedSessions: getSavedSessions,
        saveSessionToHistory: saveSessionToHistory,
        deleteSessionFromHistory: deleteSessionFromHistory,
        clearAllSessions: clearAllSessions,
        getPersistedArticleCache: getPersistedArticleCache,
        persistArticleToCache: persistArticleToCache,
        exportSessionAsJsonFile: exportSessionAsJsonFile,
        parseSessionJson: parseSessionJson
    };

    global.WikiApp = global.WikiApp || {};
    global.WikiApp.utils = utils;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = utils;
    }
})(typeof window !== 'undefined' ? window : globalThis);


