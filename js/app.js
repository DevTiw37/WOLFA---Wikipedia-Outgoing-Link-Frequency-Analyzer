/**
 * Application Entry Point and Coordinator.
 * Manages core state, binds DOM events, and orchestrates actions.
 */
(function (global) {
    'use strict';

    // Resolvers for global namespace
    function getParser() {
        return (global.WikiApp && global.WikiApp.parser) || {};
    }
    function getUI() {
        return (global.WikiApp && global.WikiApp.ui) || {};
    }
    function getUtils() {
        return (global.WikiApp && global.WikiApp.utils) || {};
    }

    // --- Global Application State ---
    let currentAnalysisData = null;
    let filteredLinks = [];
    let currentSort = { field: 'count', direction: 'desc' };

    function initApp() {
        // --- DOM References ---
        const analyzeForm = document.getElementById('analyzeForm');
        const wikiInput = document.getElementById('wikiInput');
        const langSelect = document.getElementById('langSelect');
        const clearBtn = document.getElementById('clearBtn');
        const excludeNav = document.getElementById('excludeNav');
        const excludeInfobox = document.getElementById('excludeInfobox');

        const tableSearchInput = document.getElementById('tableSearchInput');
        const minFreqFilter = document.getElementById('minFreqFilter');
        const resultsSection = document.getElementById('resultsSection');

        const sortTitleBtn = document.getElementById('sortTitleBtn');
        const sortFreqBtn = document.getElementById('sortFreqBtn');

        const tabBtnTable = document.getElementById('tabBtnTable');
        const tabBtnChart = document.getElementById('tabBtnChart');
        const tabBtnCloud = document.getElementById('tabBtnCloud');

        const previewModal = document.getElementById('previewModal');
        const closeModalBtn = document.getElementById('closeModalBtn');

        const exportCsvBtn = document.getElementById('exportCsvBtn');
        const exportJsonBtn = document.getElementById('exportJsonBtn');
        const copyListBtn = document.getElementById('copyListBtn');

        if (!analyzeForm) return;

        // --- Helper Functions ---

        /**
         * Filter and Sort the dataset based on active user constraints, then trigger a redraw.
         */
        function applyFiltersAndRender() {
            if (!currentAnalysisData) return;

            const query = (tableSearchInput ? tableSearchInput.value : '').toLowerCase().trim();
            const minFreq = parseInt(minFreqFilter ? minFreqFilter.value : '1', 10) || 1;

            // Filter
            filteredLinks = currentAnalysisData.links.filter(item => {
                const matchesSearch = !query || 
                                     item.title.toLowerCase().includes(query) || 
                                     (item.anchorTexts && item.anchorTexts.some(a => a.toLowerCase().includes(query)));
                const matchesFreq = item.count >= minFreq;
                return matchesSearch && matchesFreq;
            });

            // Sort
            filteredLinks.sort((a, b) => {
                let valA = a[currentSort.field];
                let valB = b[currentSort.field];
                if (typeof valA === 'string') {
                    return currentSort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                }
                return currentSort.direction === 'asc' ? valA - valB : valB - valA;
            });

            const maxCount = currentAnalysisData.links[0]?.count || 1;
            const ui = getUI();
            if (ui.renderTableBody) {
                ui.renderTableBody(filteredLinks, maxCount, handlePreviewTrigger);
            }
        }

        /**
         * Renders the complete dashboard once new data is analyzed.
         * @param {Object} data 
         */
        function renderDashboard(data) {
            const ui = getUI();
            if (ui.renderDashboardStats) ui.renderDashboardStats(data);

            // Reset filters
            if (tableSearchInput) tableSearchInput.value = '';
            if (minFreqFilter) minFreqFilter.value = '1';
            currentSort = { field: 'count', direction: 'desc' };

            applyFiltersAndRender();
            if (ui.renderChart) ui.renderChart(data.links.slice(0, 20));
            if (ui.renderLinkCloud) ui.renderLinkCloud(data.links.slice(0, 60), handlePreviewTrigger);
        }

        /**
         * Action trigger when user clicks on eye/title of an outgoing link.
         * Launches the preview Modal.
         * @param {string} title 
         * @param {number} count 
         */
        function handlePreviewTrigger(title, count) {
            if (!currentAnalysisData) return;
            const ui = getUI();
            if (ui.openLinkPreview) {
                ui.openLinkPreview(title, count, currentAnalysisData.lang);
            }
        }

        // --- Event Listeners ---

        // Form Input interactions
        if (wikiInput) {
            wikiInput.addEventListener('input', () => {
                if (wikiInput.value.length > 0) {
                    if (clearBtn) clearBtn.classList.remove('hidden');
                } else {
                    if (clearBtn) clearBtn.classList.add('hidden');
                }
            });
        }

        if (clearBtn && wikiInput) {
            clearBtn.addEventListener('click', () => {
                wikiInput.value = '';
                clearBtn.classList.add('hidden');
                wikiInput.focus();
            });
        }

        // Preset sample buttons binding
        document.querySelectorAll('.sample-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const sampleText = btn.getAttribute('data-sample');
                if (!sampleText || !wikiInput) return;
                
                wikiInput.value = sampleText;
                if (clearBtn) clearBtn.classList.remove('hidden');
                if (langSelect) langSelect.value = 'en';

                if (typeof analyzeForm.requestSubmit === 'function') {
                    analyzeForm.requestSubmit();
                } else {
                    analyzeForm.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            });
        });

        // Form submission handler
        analyzeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rawVal = wikiInput ? wikiInput.value.trim() : '';
            if (!rawVal) return;

            const ui = getUI();
            const parser = getParser();

            if (ui.showLoading) ui.showLoading(true);
            if (ui.hideError) ui.hideError();

            try {
                const analyzeFn = parser.analyzeWikipediaLinks;
                if (!analyzeFn) {
                    throw new Error('Parser module not loaded properly.');
                }

                const data = await analyzeFn(rawVal, langSelect ? langSelect.value : 'en', {
                    excludeNav: excludeNav ? excludeNav.checked : true,
                    excludeInfobox: excludeInfobox ? excludeInfobox.checked : true
                });

                currentAnalysisData = data;

                // Sync detected language back to dropdown
                if (langSelect && data.lang) {
                    const opt = langSelect.querySelector(`option[value="${data.lang}"]`);
                    if (opt) langSelect.value = data.lang;
                }

                renderDashboard(data);
                if (ui.showLoading) ui.showLoading(false);
                if (resultsSection) resultsSection.classList.remove('hidden');
            } catch (err) {
                if (ui.showLoading) ui.showLoading(false);
                if (ui.showError) ui.showError(err.message || 'Error fetching article links.');
            }
        });

        // Table Filtering & Search Input
        if (tableSearchInput) tableSearchInput.addEventListener('input', applyFiltersAndRender);
        if (minFreqFilter) minFreqFilter.addEventListener('change', applyFiltersAndRender);

        // Table Sorting Header Controls
        if (sortTitleBtn) {
            sortTitleBtn.addEventListener('click', () => {
                const icon = sortTitleBtn.querySelector('i');
                const freqIcon = sortFreqBtn ? sortFreqBtn.querySelector('i') : null;

                if (freqIcon) freqIcon.className = 'fa-solid fa-sort text-slate-400 ml-1';

                if (currentSort.field === 'title') {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.field = 'title';
                    currentSort.direction = 'asc';
                }

                if (icon) {
                    icon.className = currentSort.direction === 'asc' 
                        ? 'fa-solid fa-sort-up text-blue-600 ml-1' 
                        : 'fa-solid fa-sort-down text-blue-600 ml-1';
                }
                applyFiltersAndRender();
            });
        }

        if (sortFreqBtn) {
            sortFreqBtn.addEventListener('click', () => {
                const icon = sortFreqBtn.querySelector('i');
                const titleIcon = sortTitleBtn ? sortTitleBtn.querySelector('i') : null;

                if (titleIcon) titleIcon.className = 'fa-solid fa-sort text-slate-400 ml-1';

                if (currentSort.field === 'count') {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.field = 'count';
                    currentSort.direction = 'desc';
                }

                if (icon) {
                    icon.className = currentSort.direction === 'asc' 
                        ? 'fa-solid fa-sort-up text-blue-600 ml-1' 
                        : 'fa-solid fa-sort-down text-blue-600 ml-1';
                }
                applyFiltersAndRender();
            });
        }

        // Tab Toggles
        if (tabBtnTable) tabBtnTable.addEventListener('click', () => getUI().switchTab?.('table'));
        if (tabBtnChart) tabBtnChart.addEventListener('click', () => getUI().switchTab?.('chart'));
        if (tabBtnCloud) tabBtnCloud.addEventListener('click', () => getUI().switchTab?.('cloud'));

        // Modal Close bindings
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => getUI().closeLinkPreview?.());
        if (previewModal) {
            previewModal.addEventListener('click', (e) => {
                if (e.target === previewModal) getUI().closeLinkPreview?.();
            });
        }

        // Keyboard shortcut: Escape to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                getUI().closeLinkPreview?.();
            }
        });

        // Export triggers
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => {
                if (!filteredLinks.length || !currentAnalysisData) return;
                const utils = getUtils();
                // Prefix UTF-8 BOM so Excel on Windows renders non-ASCII characters properly
                let csv = '\uFEFFRank,Target Wikipedia Article,Frequency Count,Wikipedia URL\n';
                filteredLinks.forEach((item, idx) => {
                    csv += `${idx + 1},"${item.title.replace(/"/g, '""')}",${item.count},"${item.url}"\n`;
                });
                if (utils.downloadFile) {
                    const safeName = currentAnalysisData.title.replace(/[^a-zA-Z0-9_-]/g, '_');
                    utils.downloadFile(csv, `${safeName}_outgoing_links.csv`, 'text/csv;charset=utf-8;');
                }
                if (utils.showToast) utils.showToast('Exported CSV file successfully!');
            });
        }

        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => {
                if (!filteredLinks.length || !currentAnalysisData) return;
                const utils = getUtils();
                const jsonStr = JSON.stringify({
                    sourceArticle: currentAnalysisData.title,
                    language: currentAnalysisData.lang,
                    analyzedAt: new Date().toISOString(),
                    totalUniqueLinks: currentAnalysisData.totalUnique,
                    totalOccurrences: currentAnalysisData.totalOccurrences,
                    links: filteredLinks
                }, null, 2);
                if (utils.downloadFile) {
                    const safeName = currentAnalysisData.title.replace(/[^a-zA-Z0-9_-]/g, '_');
                    utils.downloadFile(jsonStr, `${safeName}_outgoing_links.json`, 'application/json');
                }
                if (utils.showToast) utils.showToast('Exported JSON file successfully!');
            });
        }

        if (copyListBtn) {
            copyListBtn.addEventListener('click', () => {
                if (!filteredLinks.length) return;
                const utils = getUtils();
                const text = filteredLinks.map((l, i) => `${i + 1}. ${l.title} (${l.count} occurrences) - ${l.url}`).join('\n');
                if (utils.copyToClipboard) utils.copyToClipboard(text);
                if (utils.showToast) utils.showToast('Copied formatted link list to clipboard!');
            });
        }
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

    global.WikiApp = global.WikiApp || {};
    global.WikiApp.init = initApp;
})(typeof window !== 'undefined' ? window : globalThis);

