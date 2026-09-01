/**
 * Application Entry Point and Coordinator.
 * Manages core state, navigation history trail, deep crawl workflows, and binds DOM events.
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

    // --- Navigation History State for Recursive Drill-Down ---
    let analysisHistory = [];
    let currentHistoryIndex = -1;
    let currentClusterData = null;

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
        const tabBtnNetwork = document.getElementById('tabBtnNetwork');

        const deepCrawlTopN = document.getElementById('deepCrawlTopN');
        const startDeepCrawlBtn = document.getElementById('startDeepCrawlBtn');

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
                ui.renderTableBody(filteredLinks, maxCount, handlePreviewTrigger, drillDown);
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

            // Update breadcrumbs
            if (ui.renderBreadcrumbs) {
                ui.renderBreadcrumbs(analysisHistory, currentHistoryIndex, navigateToHistoryIndex);
            }
        }

        /**
         * Recursively drills down into any target article with 1 click.
         * Caches results and manages navigation breadcrumb history.
         * @param {string} targetTitle 
         * @param {string} optLang 
         */
        async function drillDown(targetTitle, optLang) {
            if (!targetTitle) return;
            const ui = getUI();
            const parser = getParser();
            const utils = getUtils();

            const targetLang = optLang || (currentAnalysisData ? currentAnalysisData.lang : (langSelect ? langSelect.value : 'en'));

            if (ui.showLoading) ui.showLoading(true);
            if (ui.hideError) ui.hideError();

            try {
                const analyzeFn = parser.analyzeWikipediaLinks;
                if (!analyzeFn) {
                    throw new Error('Parser module not loaded properly.');
                }

                const data = await analyzeFn(targetTitle, targetLang, {
                    excludeNav: excludeNav ? excludeNav.checked : true,
                    excludeInfobox: excludeInfobox ? excludeInfobox.checked : true
                });

                // Update history trail
                if (currentHistoryIndex >= 0 && currentHistoryIndex < analysisHistory.length - 1) {
                    analysisHistory = analysisHistory.slice(0, currentHistoryIndex + 1);
                }

                // Check if already in history as current
                if (currentHistoryIndex < 0 || analysisHistory[currentHistoryIndex].title.toLowerCase() !== data.title.toLowerCase()) {
                    analysisHistory.push(data);
                    currentHistoryIndex = analysisHistory.length - 1;
                }

                currentAnalysisData = data;
                currentClusterData = null; // reset cluster data for new root

                // Sync input & select
                if (wikiInput) {
                    wikiInput.value = data.title;
                    if (clearBtn) clearBtn.classList.remove('hidden');
                }
                if (langSelect && data.lang) {
                    const opt = langSelect.querySelector(`option[value="${data.lang}"]`);
                    if (opt) langSelect.value = data.lang;
                }

                renderDashboard(data);
                if (ui.showLoading) ui.showLoading(false);
                if (resultsSection) resultsSection.classList.remove('hidden');
                ui.switchTab('table');

                if (utils.showToast) {
                    utils.showToast(`Drilled into: ${data.title}`);
                }
            } catch (err) {
                if (ui.showLoading) ui.showLoading(false);
                if (ui.showError) ui.showError(err.message || 'Error fetching article links.');
            }
        }

        /**
         * Navigates to a specific previous step in the breadcrumbs history trail.
         * Instant response using in-memory cached data.
         * @param {number} index 
         */
        function navigateToHistoryIndex(index) {
            if (index < 0 || index >= analysisHistory.length) return;
            const utils = getUtils();
            const ui = getUI();

            currentHistoryIndex = index;
            currentAnalysisData = analysisHistory[index];

            if (wikiInput) {
                wikiInput.value = currentAnalysisData.title;
                if (clearBtn) clearBtn.classList.remove('hidden');
            }
            if (langSelect && currentAnalysisData.lang) {
                const opt = langSelect.querySelector(`option[value="${currentAnalysisData.lang}"]`);
                if (opt) langSelect.value = currentAnalysisData.lang;
            }

            renderDashboard(currentAnalysisData);
            ui.switchTab('table');

            if (utils.showToast) {
                utils.showToast(`Navigated back to: ${currentAnalysisData.title}`);
            }
        }

        /**
         * Triggers automated 2-level batch recursive crawl across top N outgoing links.
         */
        async function runBatchDeepCrawl() {
            if (!currentAnalysisData) return;
            const parser = getParser();
            const ui = getUI();
            const utils = getUtils();

            const topN = parseInt(deepCrawlTopN ? deepCrawlTopN.value : '10', 10) || 10;

            if (startDeepCrawlBtn) {
                startDeepCrawlBtn.disabled = true;
                startDeepCrawlBtn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin text-[9px]"></i><span>Crawling...</span>`;
            }

            try {
                const crawlFn = parser.analyzeRecursiveCluster;
                if (!crawlFn) throw new Error('Recursive cluster crawler not available.');

                const clusterData = await crawlFn(
                    currentAnalysisData,
                    currentAnalysisData.lang,
                    topN,
                    {
                        excludeNav: excludeNav ? excludeNav.checked : true,
                        excludeInfobox: excludeInfobox ? excludeInfobox.checked : true
                    },
                    ({ current, total, targetTitle, percent }) => {
                        if (ui.showCrawlProgress) {
                            ui.showCrawlProgress(true, current, total, targetTitle, percent);
                        }
                    }
                );

                currentClusterData = clusterData;

                if (ui.showCrawlProgress) ui.showCrawlProgress(false);
                if (ui.renderNetworkView) {
                    ui.renderNetworkView(clusterData, drillDown, handlePreviewTrigger);
                }
                if (ui.switchTab) ui.switchTab('network');

                if (utils.showToast) {
                    utils.showToast(`Deep crawl completed for ${clusterData.crawledCount} sub-articles!`);
                }
            } catch (err) {
                if (ui.showCrawlProgress) ui.showCrawlProgress(false);
                if (ui.showError) ui.showError(err.message || 'Error during recursive cluster crawl.');
            } finally {
                if (startDeepCrawlBtn) {
                    startDeepCrawlBtn.disabled = false;
                    startDeepCrawlBtn.innerHTML = `<i class="fa-solid fa-bolt text-[9px] text-amber-300"></i><span>Run</span>`;
                }
            }
        }

        /**
         * Action trigger when user clicks on eye/title of an outgoing link.
         * Launches the preview Modal with quick-drill capability.
         * @param {string} title 
         * @param {number} count 
         */
        function handlePreviewTrigger(title, count) {
            if (!currentAnalysisData) return;
            const ui = getUI();
            if (ui.openLinkPreview) {
                ui.openLinkPreview(title, count, currentAnalysisData.lang, drillDown);
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

        // Form submission handler (starts a fresh root analysis)
        analyzeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rawVal = wikiInput ? wikiInput.value.trim() : '';
            if (!rawVal) return;

            // Reset history for fresh root query
            analysisHistory = [];
            currentHistoryIndex = -1;

            await drillDown(rawVal, langSelect ? langSelect.value : 'en');
        });

        // Batch Deep Crawl Button
        if (startDeepCrawlBtn) {
            startDeepCrawlBtn.addEventListener('click', (e) => {
                e.preventDefault();
                runBatchDeepCrawl();
            });
        }

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
        if (tabBtnNetwork) {
            tabBtnNetwork.addEventListener('click', () => {
                const ui = getUI();
                ui.switchTab?.('network');
                if (currentClusterData && ui.renderNetworkView) {
                    ui.renderNetworkView(currentClusterData, drillDown, handlePreviewTrigger);
                } else if (!currentClusterData && currentAnalysisData) {
                    // Auto-prompt or display empty state with trigger
                    ui.renderNetworkView(null, drillDown, handlePreviewTrigger);
                }
            });
        }

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
                if (!currentAnalysisData) return;
                const utils = getUtils();
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
                if (!currentAnalysisData) return;
                const utils = getUtils();
                const jsonStr = JSON.stringify({
                    sourceArticle: currentAnalysisData.title,
                    language: currentAnalysisData.lang,
                    analyzedAt: new Date().toISOString(),
                    totalUniqueLinks: currentAnalysisData.totalUnique,
                    totalOccurrences: currentAnalysisData.totalOccurrences,
                    links: filteredLinks,
                    clusterNetwork: currentClusterData ? {
                        crawledCount: currentClusterData.crawledCount,
                        secondOrderHubs: (currentClusterData.secondOrderHubs || []).slice(0, 50)
                    } : null
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


