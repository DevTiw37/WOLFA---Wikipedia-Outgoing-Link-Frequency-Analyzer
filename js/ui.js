/**
 * UI Rendering and interaction module for WikiLink Frequency Analyzer.
 */
(function (global) {
    'use strict';

    // Helper to get escapeHtml safely from utils (global or fallback)
    function getEscapeHtml() {
        if (global.WikiApp && global.WikiApp.utils && global.WikiApp.utils.escapeHtml) {
            return global.WikiApp.utils.escapeHtml;
        }
        return function (str) {
            if (str === undefined || str === null) return '';
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };
    }

    // Module-level cache for Chart.js instance and current chart data
    let chartInstance = null;
    let lastChartData = null;

    // DOM Selectors cached for efficiency
    let cachedElements = null;

    function getElements() {
        if (!cachedElements) {
            cachedElements = {
                statUniqueLinks: document.getElementById('statUniqueLinks'),
                statTotalOccurrences: document.getElementById('statTotalOccurrences'),
                statTopLink: document.getElementById('statTopLink'),
                statTopLinkCount: document.getElementById('statTopLinkCount'),
                statAvgFrequency: document.getElementById('statAvgFrequency'),
                linkTableBody: document.getElementById('linkTableBody'),
                frequencyChart: document.getElementById('frequencyChart'),
                linkCloudContainer: document.getElementById('linkCloudContainer'),
                breadcrumbsContainer: document.getElementById('breadcrumbsContainer'),
                networkContentContainer: document.getElementById('networkContentContainer'),
                crawlProgressBanner: document.getElementById('crawlProgressBanner'),
                crawlProgressText: document.getElementById('crawlProgressText'),
                crawlProgressBar: document.getElementById('crawlProgressBar'),
                previewModal: document.getElementById('previewModal'),
                modalCard: document.getElementById('modalCard'),
                modalContentWrapper: document.getElementById('modalContentWrapper'),
                modalRankBadge: document.getElementById('modalRankBadge'),
                swipeOverlayUp: document.getElementById('swipeOverlayUp'),
                swipeOverlayDown: document.getElementById('swipeOverlayDown'),
                swipeOverlayRight: document.getElementById('swipeOverlayRight'),
                swipeOverlayLeft: document.getElementById('swipeOverlayLeft'),
                articleSummaryCard: document.getElementById('articleSummaryCard'),
                articleSummaryTitle: document.getElementById('articleSummaryTitle'),
                articleSummaryLang: document.getElementById('articleSummaryLang'),
                articleSummaryDescription: document.getElementById('articleSummaryDescription'),
                articleSummaryWikiLink: document.getElementById('articleSummaryWikiLink'),
                articleSummaryLoading: document.getElementById('articleSummaryLoading'),
                articleSummaryBody: document.getElementById('articleSummaryBody'),
                articleSummaryExtract: document.getElementById('articleSummaryExtract'),
                articleSummaryToggleBtn: document.getElementById('articleSummaryToggleBtn'),
                articleSummaryImg: document.getElementById('articleSummaryImg'),
                articleSummaryImgContainer: document.getElementById('articleSummaryImgContainer'),
                modalTitle: document.getElementById('modalTitle'),
                modalFreqBadge: document.getElementById('modalFreqBadge'),
                modalWikiUrl: document.getElementById('modalWikiUrl'),
                modalDrillBtn: document.getElementById('modalDrillBtn'),
                modalLoading: document.getElementById('modalLoading'),
                modalBody: document.getElementById('modalBody'),
                modalImg: document.getElementById('modalImg'),
                modalImgContainer: document.getElementById('modalImgContainer'),
                modalExtract: document.getElementById('modalExtract'),
                historyModal: document.getElementById('historyModal'),
                closeHistoryModalBtn: document.getElementById('closeHistoryModalBtn'),
                historySearchInput: document.getElementById('historySearchInput'),
                historyImportBtn: document.getElementById('historyImportBtn'),
                clearAllHistoryBtn: document.getElementById('clearAllHistoryBtn'),
                historyListContainer: document.getElementById('historyListContainer'),
                historyCountBadge: document.getElementById('historyCountBadge'),
                historyModalBtn: document.getElementById('historyModalBtn'),
                importSessionBtn: document.getElementById('importSessionBtn'),
                sessionFileInput: document.getElementById('sessionFileInput'),
                exportSessionBtn: document.getElementById('exportSessionBtn'),
                loadingState: document.getElementById('loadingState'),
                resultsSection: document.getElementById('resultsSection'),
                errorState: document.getElementById('errorState'),
                errorMessage: document.getElementById('errorMessage')
            };
        }
        return cachedElements;
    }

    /**
     * Display or hide the loading spinner
     * @param {boolean} show 
     */
    function showLoading(show) {
        const el = getElements();
        if (show) {
            if (el.loadingState) el.loadingState.classList.remove('hidden');
            if (el.resultsSection) el.resultsSection.classList.add('hidden');
            if (el.errorState) el.errorState.classList.add('hidden');
        } else {
            if (el.loadingState) el.loadingState.classList.add('hidden');
        }
    }

    /**
     * Show error message alert
     * @param {string} msg 
     */
    function showError(msg) {
        const el = getElements();
        if (el.errorMessage) el.errorMessage.textContent = msg;
        if (el.errorState) el.errorState.classList.remove('hidden');
        if (el.resultsSection) el.resultsSection.classList.add('hidden');
    }

    /**
     * Hide the error message alert
     */
    function hideError() {
        const el = getElements();
        if (el.errorState) el.errorState.classList.add('hidden');
    }

    /**
     * Display or update the batch recursive crawl progress bar
     */
    function showCrawlProgress(show, current, total, targetTitle, percent) {
        const el = getElements();
        if (!el.crawlProgressBanner) return;

        if (show) {
            el.crawlProgressBanner.classList.remove('hidden');
            if (el.crawlProgressText) {
                el.crawlProgressText.textContent = `Analyzing sub-article ${current}/${total}: ${targetTitle || '...'}`;
            }
            if (el.crawlProgressBar) {
                el.crawlProgressBar.style.width = `${Math.min(100, Math.max(5, percent || 0))}%`;
            }
        } else {
            el.crawlProgressBanner.classList.add('hidden');
        }
    }

    /**
     * Switch tabs in the main content card
     * @param {string} tabId - 'table', 'chart', 'cloud', 'network'
     */
    function switchTab(tabId) {
        const tabBtnTable = document.getElementById('tabBtnTable');
        const tabBtnChart = document.getElementById('tabBtnChart');
        const tabBtnCloud = document.getElementById('tabBtnCloud');
        const tabBtnNetwork = document.getElementById('tabBtnNetwork');

        const tabContentTable = document.getElementById('tabContentTable');
        const tabContentChart = document.getElementById('tabContentChart');
        const tabContentCloud = document.getElementById('tabContentCloud');
        const tabContentNetwork = document.getElementById('tabContentNetwork');

        const btns = [tabBtnTable, tabBtnChart, tabBtnCloud, tabBtnNetwork];
        const contents = [tabContentTable, tabContentChart, tabContentCloud, tabContentNetwork];

        btns.forEach(b => {
            if (b) {
                b.classList.remove('text-blue-600', 'border-blue-600');
                b.classList.add('text-slate-500', 'border-transparent');
            }
        });
        contents.forEach(c => {
            if (c) c.classList.add('hidden');
        });

        if (tabId === 'table' && tabBtnTable && tabContentTable) {
            tabBtnTable.classList.add('text-blue-600', 'border-blue-600');
            tabContentTable.classList.remove('hidden');
        } else if (tabId === 'chart' && tabBtnChart && tabContentChart) {
            tabBtnChart.classList.add('text-blue-600', 'border-blue-600');
            tabContentChart.classList.remove('hidden');

            // Resize or redraw chart if needed when tab becomes visible
            if (chartInstance) {
                chartInstance.resize();
            } else if (lastChartData) {
                renderChart(lastChartData);
            }
        } else if (tabId === 'cloud' && tabBtnCloud && tabContentCloud) {
            tabBtnCloud.classList.add('text-blue-600', 'border-blue-600');
            tabContentCloud.classList.remove('hidden');
        } else if (tabId === 'network' && tabBtnNetwork && tabContentNetwork) {
            tabBtnNetwork.classList.add('text-blue-600', 'border-blue-600');
            tabContentNetwork.classList.remove('hidden');
        }
    }

    /**
     * Renders interactive breadcrumb trail and navigation history
     * @param {Array<Object>} history - Array of { title, lang }
     * @param {number} currentIndex - Current active position in history
     * @param {Function} onNavigate - Callback when an ancestor breadcrumb or back button is clicked
     */
    function renderBreadcrumbs(history, currentIndex, onNavigate) {
        const el = getElements();
        const escape = getEscapeHtml();
        if (!el.breadcrumbsContainer) return;

        if (!history || history.length <= 1) {
            el.breadcrumbsContainer.innerHTML = '';
            el.breadcrumbsContainer.classList.add('hidden');
            return;
        }

        el.breadcrumbsContainer.classList.remove('hidden');

        let html = `
            <div class="flex items-center justify-between flex-wrap gap-2 w-full py-2.5 px-4 bg-slate-100/90 border border-slate-200/80 rounded-xl text-xs">
                <div class="flex items-center flex-wrap gap-1.5 text-slate-600 font-medium">
                    <span class="text-slate-400 font-semibold uppercase tracking-wider text-[10px] mr-1 flex items-center">
                        <i class="fa-solid fa-sitemap mr-1.5 text-blue-600"></i> Drill Path:
                    </span>
        `;

        history.forEach((item, idx) => {
            const isCurrent = idx === currentIndex;
            const isAncestor = idx < currentIndex;

            if (idx > 0) {
                html += `<i class="fa-solid fa-chevron-right text-[10px] text-slate-300 mx-1"></i>`;
            }

            if (isCurrent) {
                html += `
                    <span class="inline-flex items-center px-2.5 py-1 rounded-lg font-bold bg-blue-600 text-white shadow-xs">
                        ${idx === 0 ? '<i class="fa-solid fa-house mr-1.5 text-[10px]"></i>' : ''}
                        ${escape(item.title)}
                    </span>
                `;
            } else {
                html += `
                    <button type="button" class="breadcrumb-jump-btn inline-flex items-center px-2.5 py-1 rounded-lg text-slate-700 bg-white hover:bg-slate-200 hover:text-blue-700 border border-slate-200/80 transition-colors cursor-pointer" data-index="${idx}">
                        ${idx === 0 ? '<i class="fa-solid fa-house mr-1.5 text-[10px] text-slate-400"></i>' : ''}
                        ${escape(item.title)}
                    </button>
                `;
            }
        });

        html += `
                </div>
                ${currentIndex > 0 ? `
                    <button type="button" id="historyBackBtn" class="px-3 py-1 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-200 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs">
                        <i class="fa-solid fa-arrow-left text-[11px] text-blue-600"></i>
                        <span>Back to ${escape(history[currentIndex - 1].title)}</span>
                    </button>
                ` : ''}
            </div>
        `;

        el.breadcrumbsContainer.innerHTML = html;

        // Bind clicks
        el.breadcrumbsContainer.querySelectorAll('.breadcrumb-jump-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                if (typeof onNavigate === 'function') onNavigate(idx);
            });
        });

        const backBtn = el.breadcrumbsContainer.querySelector('#historyBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (typeof onNavigate === 'function') onNavigate(currentIndex - 1);
            });
        }
    }

    /**
     * Populates top dashboard KPIs
     * @param {Object} data - Analyzed results object
     */
    function renderDashboardStats(data) {
        const el = getElements();
        
        if (el.statUniqueLinks) el.statUniqueLinks.textContent = (data.totalUnique || 0).toLocaleString();
        if (el.statTotalOccurrences) el.statTotalOccurrences.textContent = (data.totalOccurrences || 0).toLocaleString();

        if (data.links && data.links.length > 0) {
            const top = data.links[0];
            if (el.statTopLink) el.statTopLink.textContent = top.title;
            if (el.statTopLinkCount) el.statTopLinkCount.textContent = `${top.count} occurrence${top.count > 1 ? 's' : ''}`;
            
            const avg = data.totalUnique > 0 ? (data.totalOccurrences / data.totalUnique).toFixed(2) : '0.0';
            if (el.statAvgFrequency) el.statAvgFrequency.textContent = avg;
        } else {
            if (el.statTopLink) el.statTopLink.textContent = 'None';
            if (el.statTopLinkCount) el.statTopLinkCount.textContent = '0 occurrences';
            if (el.statAvgFrequency) el.statAvgFrequency.textContent = '0.0';
        }
    }

    /**
     * Redraws the Ranked Links table body based on current sorted/filtered dataset
     * @param {Array<Object>} links - Filtered and sorted links array
     * @param {number} maxCount - Highest frequency of any single link (for percentage bar)
     * @param {Function} onPreviewClick - Callback trigger on article preview requests
     * @param {Function} onDrillDownClick - Callback trigger for recursive analysis of target link
     */
    function renderTableBody(links, maxCount, onPreviewClick, onDrillDownClick) {
        const el = getElements();
        const escape = getEscapeHtml();
        if (!el.linkTableBody) return;
        
        el.linkTableBody.innerHTML = '';

        if (!links || links.length === 0) {
            el.linkTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-slate-400">
                        <i class="fa-solid fa-folder-open text-2xl mb-2 block"></i>
                        No outgoing internal links matched your filter.
                    </td>
                </tr>
            `;
            return;
        }

        const safeMax = maxCount > 0 ? maxCount : 1;

        links.forEach((item, idx) => {
            const pct = Math.min(100, Math.max(2, Math.round((item.count / safeMax) * 100)));
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50/80 transition-colors group';

            const anchorsSnippet = item.anchorTexts && item.anchorTexts.length > 0 
                ? item.anchorTexts.slice(0, 3).map(a => `<span class="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] mr-1 mb-0.5 max-w-[120px] truncate">${escape(a)}</span>`).join('')
                : '<span class="text-slate-300 italic">Same as title</span>';

            tr.innerHTML = `
                <td class="py-3 px-4 text-center font-semibold text-slate-400">${idx + 1}</td>
                <td class="py-3 px-4 font-semibold text-slate-800">
                    <div class="flex items-center space-x-2">
                        <button type="button" class="preview-trigger text-left hover:text-blue-600 focus:outline-none transition-colors cursor-pointer" data-title="${escape(item.title)}" data-count="${item.count}">
                            ${escape(item.title)}
                        </button>
                    </div>
                </td>
                <td class="py-3 px-4 text-center">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        ${item.count}
                    </span>
                </td>
                <td class="py-3 px-4 hidden md:table-cell">
                    <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                    </div>
                </td>
                <td class="py-3 px-4 hidden lg:table-cell">
                    ${anchorsSnippet}
                </td>
                <td class="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                    <button type="button" class="drill-trigger px-2.5 py-1 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-semibold rounded-lg transition-all text-xs cursor-pointer shadow-xs inline-flex items-center space-x-1" data-title="${escape(item.title)}" title="Recursively analyze outgoing links of this article">
                        <i class="fa-solid fa-bolt text-[10px]"></i>
                        <span class="hidden sm:inline">Drill</span>
                    </button>
                    <button type="button" class="preview-trigger px-2 py-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors cursor-pointer" data-title="${escape(item.title)}" data-count="${item.count}" title="Preview Summary">
                        <i class="fa-solid fa-eye text-xs"></i>
                    </button>
                    <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="inline-block px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors" title="Open in Wikipedia">
                        <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                    </a>
                </td>
            `;
            el.linkTableBody.appendChild(tr);
        });

        // Attach preview click events
        el.linkTableBody.querySelectorAll('.preview-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const title = btn.getAttribute('data-title');
                const count = parseInt(btn.getAttribute('data-count'), 10) || 1;
                if (typeof onPreviewClick === 'function') {
                    onPreviewClick(title, count);
                }
            });
        });

        // Attach drill-down click events
        el.linkTableBody.querySelectorAll('.drill-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const title = btn.getAttribute('data-title');
                if (typeof onDrillDownClick === 'function') {
                    onDrillDownClick(title);
                }
            });
        });
    }

    /**
     * Renders the frequency distribution bar chart using Chart.js
     * @param {Array<Object>} topLinks - Top 20 internal links
     */
    function renderChart(topLinks) {
        const el = getElements();
        lastChartData = topLinks;

        if (!el.frequencyChart) return;

        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            const parent = el.frequencyChart.parentElement;
            if (parent) {
                parent.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center space-y-2">
                        <i class="fa-solid fa-chart-simple text-3xl"></i>
                        <p class="text-xs">Chart library is loading or blocked by network.</p>
                    </div>
                `;
            }
            return;
        }

        const ctx = el.frequencyChart.getContext('2d');
        if (!ctx) return;

        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }

        if (!topLinks || topLinks.length === 0) return;

        const labels = topLinks.map(l => l.title);
        const counts = topLinks.map(l => l.count);

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Frequency (Occurrences)',
                    data: counts,
                    backgroundColor: 'rgba(37, 99, 235, 0.85)',
                    borderColor: 'rgba(37, 99, 235, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.parsed.y} occurrence${ctx.parsed.y > 1 ? 's' : ''}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            font: { size: 10 },
                            maxRotation: 45,
                            minRotation: 30,
                            autoSkip: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    }
                }
            }
        });
    }

    /**
     * Builds a weighted dynamic link cloud in the UI
     * @param {Array<Object>} links - First 50-60 target links
     * @param {Function} onPreviewClick - Callback trigger on link click 
     */
    function renderLinkCloud(links, onPreviewClick) {
        const el = getElements();
        const escape = getEscapeHtml();
        if (!el.linkCloudContainer) return;
        
        el.linkCloudContainer.innerHTML = '';

        if (!links || links.length === 0) {
            el.linkCloudContainer.innerHTML = `
                <p class="text-xs text-slate-400 py-8 text-center">No internal links to display in cloud.</p>
            `;
            return;
        }

        const maxCount = links[0]?.count || 1;
        const minCount = links[links.length - 1]?.count || 1;

        links.forEach(item => {
            // Calculate font scale between 12px and 26px
            const factor = maxCount === minCount ? 0.5 : (item.count - minCount) / (maxCount - minCount);
            const fontSize = Math.round(12 + factor * 14);

            // Color coding by frequency weight
            let colorClasses = 'bg-white text-slate-700 hover:text-blue-700 hover:bg-blue-50 border-slate-200';
            if (factor > 0.6) {
                colorClasses = 'bg-blue-50 text-blue-900 font-bold border-blue-200 hover:bg-blue-100';
            } else if (factor > 0.3) {
                colorClasses = 'bg-indigo-50/70 text-indigo-900 font-semibold border-indigo-200 hover:bg-indigo-100';
            }

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `preview-trigger m-1 px-3 py-1.5 border rounded-xl shadow-sm text-center transition-all cursor-pointer ${colorClasses}`;
            btn.style.fontSize = `${fontSize}px`;
            btn.setAttribute('data-title', item.title);
            btn.setAttribute('data-count', item.count);
            btn.innerHTML = `${escape(item.title)} <span class="text-[10px] text-blue-600 font-bold ml-1">(${item.count})</span>`;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof onPreviewClick === 'function') {
                    onPreviewClick(item.title, item.count);
                }
            });

            el.linkCloudContainer.appendChild(btn);
        });
    }

    /**
     * Renders the 2-Level Recursive Network / Cluster Deep Crawl View
     * @param {Object} clusterData - Cluster analysis result object from analyzeRecursiveCluster
     * @param {Function} onDrillDownClick - Callback for recursive drill into any topic
     * @param {Function} onPreviewClick - Callback to preview topic summary
     */
    function renderNetworkView(clusterData, onDrillDownClick, onPreviewClick) {
        const el = getElements();
        const escape = getEscapeHtml();
        if (!el.networkContentContainer) return;

        if (!clusterData || !clusterData.subArticles || clusterData.subArticles.length === 0) {
            el.networkContentContainer.innerHTML = `
                <div class="p-12 text-center text-slate-400 space-y-3">
                    <i class="fa-solid fa-diagram-project text-4xl text-slate-300"></i>
                    <h4 class="text-sm font-semibold text-slate-700">No Recursive Cluster Data Yet</h4>
                    <p class="text-xs max-w-md mx-auto text-slate-500">
                        Click "Run Deep Crawl" above to automatically crawl top outgoing links and map cross-article topic hubs.
                    </p>
                </div>
            `;
            return;
        }

        const topHubs = (clusterData.secondOrderHubs || []).slice(0, 30);
        const maxHubFreq = topHubs[0]?.totalOccurrences || 1;

        let html = `
            <!-- Cluster Overview Stats -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sub-Articles Analyzed</span>
                    <p class="text-xl font-bold text-slate-900 mt-1">${clusterData.crawledCount} of ${clusterData.totalRequested}</p>
                    <span class="text-xs text-blue-600 font-medium">Top level-1 targets</span>
                </div>
                <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">2nd-Order Unique Topics</span>
                    <p class="text-xl font-bold text-slate-900 mt-1">${(clusterData.totalSecondOrderUnique || 0).toLocaleString()}</p>
                    <span class="text-xs text-indigo-600 font-medium">Outbound unique links</span>
                </div>
                <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total 2nd-Order Mentions</span>
                    <p class="text-xl font-bold text-slate-900 mt-1">${(clusterData.totalSecondOrderOccurrences || 0).toLocaleString()}</p>
                    <span class="text-xs text-emerald-600 font-medium">Across all sub-articles</span>
                </div>
                <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Internal Cluster Cross-Links</span>
                    <p class="text-xl font-bold text-slate-900 mt-1">${(clusterData.internalCrossLinksCount || 0).toLocaleString()}</p>
                    <span class="text-xs text-amber-600 font-medium">Inter-cluster density</span>
                </div>
            </div>

            <!-- Section 1: Crawled Sub-Articles Cards -->
            <div class="mb-8 space-y-3">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="text-sm font-bold text-slate-800 flex items-center">
                            <i class="fa-solid fa-network-wired text-blue-600 mr-2"></i>
                            Level-1 Crawled Sub-Articles
                        </h4>
                        <p class="text-xs text-slate-500">The primary outgoing links parsed in this cluster</p>
                    </div>
                    <span class="text-xs text-slate-400 font-medium">${clusterData.subArticles.length} sub-articles</span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        `;

        clusterData.subArticles.forEach((sub, idx) => {
            const hasData = sub.data && sub.data.links;
            const topOut = hasData ? sub.data.links.slice(0, 3) : [];

            html += `
                <div class="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between space-y-3">
                    <div>
                        <div class="flex items-start justify-between">
                            <div class="flex items-center space-x-2 truncate">
                                <span class="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                    ${idx + 1}
                                </span>
                                <h5 class="font-bold text-slate-900 text-xs truncate" title="${escape(sub.title)}">
                                    ${escape(sub.title)}
                                </h5>
                            </div>
                            <span class="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0 ml-1">
                                ${sub.rootMentionCount} in root
                            </span>
                        </div>

                        ${hasData ? `
                            <p class="text-[11px] text-slate-500 mt-2">
                                <span class="font-semibold text-slate-700">${sub.data.totalUnique.toLocaleString()}</span> outgoing links (${sub.data.totalOccurrences.toLocaleString()} mentions)
                            </p>
                            <div class="mt-2 flex flex-wrap gap-1">
                                ${topOut.map(o => `<span class="inline-block bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0.5 rounded max-w-[110px] truncate" title="${escape(o.title)}">${escape(o.title)} (${o.count})</span>`).join('')}
                            </div>
                        ` : `
                            <p class="text-xs text-red-500 mt-2 italic">${escape(sub.error || 'Failed to analyze')}</p>
                        `}
                    </div>

                    <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <button type="button" class="drill-trigger px-2.5 py-1 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-semibold rounded-lg text-xs transition-colors inline-flex items-center space-x-1 cursor-pointer" data-title="${escape(sub.title)}">
                            <i class="fa-solid fa-bolt text-[10px]"></i>
                            <span>Deep Dive</span>
                        </button>
                        <button type="button" class="preview-trigger text-slate-400 hover:text-blue-600 text-xs p-1 cursor-pointer" data-title="${escape(sub.title)}" data-count="${sub.rootMentionCount}" title="Preview article">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>

            <!-- Section 2: Top Second-Order Hub Frequencies Table -->
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="text-sm font-bold text-slate-800 flex items-center">
                            <i class="fa-solid fa-circle-nodes text-indigo-600 mr-2"></i>
                            Cross-Article Topic Hubs (2nd-Order Frequencies)
                        </h4>
                        <p class="text-xs text-slate-500">Topics most frequently referenced across the cluster sub-articles</p>
                    </div>
                    <span class="text-xs text-slate-400">Top 30 Central Hubs</span>
                </div>

                <div class="overflow-x-auto border border-slate-200 rounded-xl custom-scrollbar">
                    <table class="w-full text-left text-xs text-slate-700">
                        <thead class="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                            <tr>
                                <th class="py-3 px-4 w-14 text-center">Rank</th>
                                <th class="py-3 px-4">Topic Hub</th>
                                <th class="py-3 px-4 w-44 text-center">Cluster Centrality</th>
                                <th class="py-3 px-4 w-32 text-center">Total Mentions</th>
                                <th class="py-3 px-4 hidden md:table-cell">Referenced By Sub-Articles</th>
                                <th class="py-3 px-4 w-28 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 bg-white">
        `;

        topHubs.forEach((hub, idx) => {
            const subRatio = `${hub.subArticleCount} / ${clusterData.crawledCount}`;
            const pct = Math.min(100, Math.max(2, Math.round((hub.totalOccurrences / maxHubFreq) * 100)));
            const subPills = (hub.sharedBy || []).slice(0, 3).map(s => `
                <span class="inline-block bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px] mr-1 mb-0.5 max-w-[130px] truncate" title="${escape(s.subTitle)} (${s.count}x)">
                    ${escape(s.subTitle)}
                </span>
            `).join('');

            html += `
                <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="py-3 px-4 text-center font-semibold text-slate-400">${idx + 1}</td>
                    <td class="py-3 px-4 font-semibold text-slate-800">
                        <button type="button" class="preview-trigger text-left hover:text-blue-600 focus:outline-none transition-colors cursor-pointer" data-title="${escape(hub.title)}" data-count="${hub.totalOccurrences}">
                            ${escape(hub.title)}
                        </button>
                    </td>
                    <td class="py-3 px-4 text-center">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${hub.subArticleCount > 1 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600'}">
                            ${subRatio} sub-articles
                        </span>
                    </td>
                    <td class="py-3 px-4 text-center">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            ${hub.totalOccurrences}
                        </span>
                    </td>
                    <td class="py-3 px-4 hidden md:table-cell">
                        ${subPills}
                        ${hub.sharedBy && hub.sharedBy.length > 3 ? `<span class="text-[10px] text-slate-400 font-medium">+${hub.sharedBy.length - 3} more</span>` : ''}
                    </td>
                    <td class="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button type="button" class="drill-trigger px-2.5 py-1 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-semibold rounded-lg transition-all text-xs cursor-pointer shadow-xs inline-flex items-center space-x-1" data-title="${escape(hub.title)}" title="Recursively analyze outgoing links of this article">
                            <i class="fa-solid fa-bolt text-[10px]"></i>
                            <span class="hidden sm:inline">Drill</span>
                        </button>
                        <button type="button" class="preview-trigger px-2 py-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors cursor-pointer" data-title="${escape(hub.title)}" data-count="${hub.totalOccurrences}" title="Preview Summary">
                            <i class="fa-solid fa-eye text-xs"></i>
                        </button>
                        <a href="${hub.url}" target="_blank" rel="noopener noreferrer" class="inline-block px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors" title="Open in Wikipedia">
                            <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                        </a>
                    </td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        el.networkContentContainer.innerHTML = html;

        // Attach click handlers
        el.networkContentContainer.querySelectorAll('.preview-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const title = btn.getAttribute('data-title');
                const count = parseInt(btn.getAttribute('data-count'), 10) || 1;
                if (typeof onPreviewClick === 'function') onPreviewClick(title, count);
            });
        });

        el.networkContentContainer.querySelectorAll('.drill-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const title = btn.getAttribute('data-title');
                if (typeof onDrillDownClick === 'function') onDrillDownClick(title);
            });
        });
    }

    // Shared in-memory cache for page summaries to provide zero-latency previews
    const summaryCache = new Map();

    // Active Target Link Preview State & Gestures Engine
    const previewState = {
        links: [],
        currentIndex: -1,
        lang: 'en',
        onDrillDown: null,
        abortController: null,
        isDragging: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        startTime: 0,
        gesturesInitialized: false
    };

    const SWIPE_THRESHOLD = 50; // px minimum drag distance
    const SWIPE_VELOCITY_THRESHOLD = 0.35; // px/ms velocity for quick flicks

    function hideAllSwipeOverlays() {
        const el = getElements();
        if (el.swipeOverlayUp) el.swipeOverlayUp.style.opacity = '0';
        if (el.swipeOverlayDown) el.swipeOverlayDown.style.opacity = '0';
        if (el.swipeOverlayRight) el.swipeOverlayRight.style.opacity = '0';
        if (el.swipeOverlayLeft) el.swipeOverlayLeft.style.opacity = '0';
    }

    function resetCardTransform() {
        const el = getElements();
        if (el.modalCard) {
            el.modalCard.style.transform = '';
        }
        hideAllSwipeOverlays();
    }

    function springCardBack() {
        const el = getElements();
        if (!el.modalCard) return;
        el.modalCard.classList.add('is-recovering');
        resetCardTransform();
        setTimeout(() => {
            if (el.modalCard) {
                el.modalCard.classList.remove('is-recovering');
            }
        }, 300);
    }

    function bounceCard(direction) {
        const el = getElements();
        if (!el.modalCard) return;
        el.modalCard.classList.add('is-recovering');
        const offset = direction === 'up' ? -22 : 22;
        el.modalCard.style.transform = `translate3d(0, ${offset}px, 0)`;
        setTimeout(() => {
            if (el.modalCard) {
                el.modalCard.style.transform = '';
                setTimeout(() => {
                    if (el.modalCard) el.modalCard.classList.remove('is-recovering');
                }, 200);
            }
        }, 150);
    }

    /**
     * Swiping right opens the target article in Wikipedia.
     */
    function openCurrentInWiki() {
        if (!previewState.links || previewState.currentIndex < 0) return;
        const current = previewState.links[previewState.currentIndex];
        if (!current) return;
        const lang = previewState.lang || 'en';
        const url = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(current.title.replace(/ /g, '_'))}`;

        const el = getElements();
        if (el.modalCard) {
            el.modalCard.classList.add('swipe-exit-right');
            setTimeout(() => {
                if (el.modalCard) {
                    el.modalCard.classList.remove('swipe-exit-right');
                    resetCardTransform();
                }
            }, 300);
        }

        window.open(url, '_blank', 'noopener,noreferrer');
        if (global.WikiApp && global.WikiApp.utils && global.WikiApp.utils.showToast) {
            global.WikiApp.utils.showToast(`Opened "${current.title}" on Wikipedia`);
        }
    }

    /**
     * Swiping left analyzes the ongoing link of the preview.
     */
    function analyzeCurrentPreviewLink() {
        if (!previewState.links || previewState.currentIndex < 0) return;
        const current = previewState.links[previewState.currentIndex];
        if (!current) return;
        const targetTitle = current.title;
        const drillFn = previewState.onDrillDown;

        const el = getElements();
        if (el.modalCard) {
            el.modalCard.classList.add('swipe-exit-left');
        }

        setTimeout(() => {
            closeLinkPreview();
            if (typeof drillFn === 'function') {
                drillFn(targetTitle);
            }
        }, 220);
    }

    /**
     * Swiping up gives next frequently used link; swiping down gives previous most used link.
     * @param {number} delta - +1 for next (swipe up), -1 for prev (swipe down)
     */
    function navigatePreview(delta) {
        if (!previewState.links || previewState.links.length === 0) return;

        const nextIndex = previewState.currentIndex + delta;
        const el = getElements();

        if (delta > 0) {
            // Swiping UP -> Next frequently used link
            if (nextIndex >= previewState.links.length) {
                bounceCard('up');
                if (global.WikiApp && global.WikiApp.utils && global.WikiApp.utils.showToast) {
                    global.WikiApp.utils.showToast('Reached the end of ranked links in this view.');
                }
                return;
            }
            if (el.modalCard) {
                el.modalCard.classList.add('swipe-exit-up');
            }
            setTimeout(() => {
                if (el.modalCard) el.modalCard.classList.remove('swipe-exit-up');
                resetCardTransform();
                previewState.currentIndex = nextIndex;
                renderCurrentPreview(1);
            }, 140);
        } else {
            // Swiping DOWN -> Previous most used link
            if (nextIndex < 0) {
                bounceCard('down');
                if (global.WikiApp && global.WikiApp.utils && global.WikiApp.utils.showToast) {
                    global.WikiApp.utils.showToast('Already at the #1 most frequently used link.');
                }
                return;
            }
            if (el.modalCard) {
                el.modalCard.classList.add('swipe-exit-down');
            }
            setTimeout(() => {
                if (el.modalCard) el.modalCard.classList.remove('swipe-exit-down');
                resetCardTransform();
                previewState.currentIndex = nextIndex;
                renderCurrentPreview(-1);
            }, 140);
        }
    }

    /**
     * Renders the current link item in previewState and triggers MediaWiki extract fetch
     * @param {number} [direction] - 1 (next / slide in bottom), -1 (prev / slide in top), 0 (none)
     */
    async function renderCurrentPreview(direction = 0) {
        const el = getElements();
        if (!el.previewModal) return;

        const item = previewState.links[previewState.currentIndex];
        if (!item) return;

        const title = item.title;
        const count = item.count || 1;
        const total = previewState.links.length;
        const lang = previewState.lang || 'en';

        // Headers
        if (el.modalTitle) el.modalTitle.textContent = title;
        if (el.modalRankBadge) {
            el.modalRankBadge.textContent = `Rank #${previewState.currentIndex + 1} of ${total}`;
        }
        if (el.modalFreqBadge) {
            el.modalFreqBadge.textContent = `${count} mention${count > 1 ? 's' : ''} in source article`;
        }
        if (el.modalWikiUrl) {
            el.modalWikiUrl.href = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
        }

        // Re-bind Drill button
        if (el.modalDrillBtn) {
            const newDrillBtn = el.modalDrillBtn.cloneNode(true);
            el.modalDrillBtn.parentNode.replaceChild(newDrillBtn, el.modalDrillBtn);
            cachedElements.modalDrillBtn = newDrillBtn;
            newDrillBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeLinkPreview();
                if (typeof previewState.onDrillDown === 'function') {
                    previewState.onDrillDown(title);
                }
            });
        }

        // Apply slide-in animation to modalContentWrapper if direction is specified
        if (direction !== 0 && el.modalContentWrapper) {
            el.modalContentWrapper.classList.remove('animate-slide-in-bottom', 'animate-slide-in-top');
            void el.modalContentWrapper.offsetWidth; // trigger reflow
            el.modalContentWrapper.classList.add(direction > 0 ? 'animate-slide-in-bottom' : 'animate-slide-in-top');
        }

        // Reset image and body states
        if (el.modalImg) el.modalImg.src = '';
        if (el.modalImgContainer) el.modalImgContainer.classList.add('hidden');

        // Check in-memory summary cache first
        const cacheKey = `${lang}:${title.toLowerCase()}`;
        if (summaryCache.has(cacheKey)) {
            const cached = summaryCache.get(cacheKey);
            if (el.modalLoading) el.modalLoading.classList.add('hidden');
            if (el.modalBody) el.modalBody.classList.remove('hidden');
            if (el.modalExtract) {
                el.modalExtract.textContent = cached.extract || cached.description || 'No extract summary available for this topic.';
            }
            if (cached.thumbnail && cached.thumbnail.source && el.modalImg && el.modalImgContainer) {
                el.modalImg.src = cached.thumbnail.source;
                el.modalImgContainer.classList.remove('hidden');
            }
            return;
        }

        // Otherwise show loading spinner and fetch from MediaWiki API
        if (el.modalLoading) el.modalLoading.classList.remove('hidden');
        if (el.modalBody) el.modalBody.classList.add('hidden');

        // Cancel previous pending fetch
        if (previewState.abortController) {
            previewState.abortController.abort();
        }
        previewState.abortController = new AbortController();
        const signal = previewState.abortController.signal;

        try {
            const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { signal });
            if (res.ok) {
                const data = await res.json();
                summaryCache.set(cacheKey, data);
                if (el.modalExtract) {
                    el.modalExtract.textContent = data.extract || data.description || 'No extract summary available for this topic.';
                }
                if (data.thumbnail && data.thumbnail.source && el.modalImg && el.modalImgContainer) {
                    el.modalImg.src = data.thumbnail.source;
                    el.modalImgContainer.classList.remove('hidden');
                }
            } else {
                if (el.modalExtract) el.modalExtract.textContent = 'Could not fetch extract summary for this article.';
            }
        } catch (err) {
            if (err.name === 'AbortError') return; // Cancelled by user swiping to another link
            if (el.modalExtract) el.modalExtract.textContent = 'Failed to load Wikipedia summary preview.';
        } finally {
            if (!signal.aborted) {
                if (el.modalLoading) el.modalLoading.classList.add('hidden');
                if (el.modalBody) el.modalBody.classList.remove('hidden');
            }
        }
    }

    /**
     * Initializes unified Pointer & Touch swipe gesture listeners on the modal card
     */
    function setupModalGestures() {
        if (previewState.gesturesInitialized) return;

        const el = getElements();
        if (!el.modalCard) return;
        previewState.gesturesInitialized = true;

        const getTouchPoint = (e) => {
            const touch = e.touches[0] || e.changedTouches[0];
            return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
        };

        const startDrag = (clientX, clientY) => {
            previewState.isDragging = true;
            previewState.startX = clientX;
            previewState.startY = clientY;
            previewState.currentX = clientX;
            previewState.currentY = clientY;
            previewState.startTime = Date.now();

            el.modalCard.classList.add('is-dragging');
            el.modalCard.classList.remove('is-recovering');
        };

        const moveDrag = (clientX, clientY) => {
            if (!previewState.isDragging) return;

            previewState.currentX = clientX;
            previewState.currentY = clientY;

            const dx = previewState.currentX - previewState.startX;
            const dy = previewState.currentY - previewState.startY;

            // Damped translation for natural tactile resistance
            const dampedX = dx * 0.72;
            const dampedY = dy * 0.72;
            const rot = (dx / 350) * 10;

            el.modalCard.style.transform = `translate3d(${dampedX}px, ${dampedY}px, 0) rotate(${rot}deg)`;

            // Directional overlay feedback
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);

            if (absY > absX) {
                if (dy < -15) {
                    const op = Math.min(1, (-dy - 15) / 50);
                    if (el.swipeOverlayUp) el.swipeOverlayUp.style.opacity = String(op);
                    if (el.swipeOverlayDown) el.swipeOverlayDown.style.opacity = '0';
                    if (el.swipeOverlayLeft) el.swipeOverlayLeft.style.opacity = '0';
                    if (el.swipeOverlayRight) el.swipeOverlayRight.style.opacity = '0';
                } else if (dy > 15) {
                    const op = Math.min(1, (dy - 15) / 50);
                    if (el.swipeOverlayDown) el.swipeOverlayDown.style.opacity = String(op);
                    if (el.swipeOverlayUp) el.swipeOverlayUp.style.opacity = '0';
                    if (el.swipeOverlayLeft) el.swipeOverlayLeft.style.opacity = '0';
                    if (el.swipeOverlayRight) el.swipeOverlayRight.style.opacity = '0';
                } else {
                    hideAllSwipeOverlays();
                }
            } else {
                if (dx > 15) {
                    const op = Math.min(1, (dx - 15) / 50);
                    if (el.swipeOverlayRight) el.swipeOverlayRight.style.opacity = String(op);
                    if (el.swipeOverlayLeft) el.swipeOverlayLeft.style.opacity = '0';
                    if (el.swipeOverlayUp) el.swipeOverlayUp.style.opacity = '0';
                    if (el.swipeOverlayDown) el.swipeOverlayDown.style.opacity = '0';
                } else if (dx < -15) {
                    const op = Math.min(1, (-dx - 15) / 50);
                    if (el.swipeOverlayLeft) el.swipeOverlayLeft.style.opacity = String(op);
                    if (el.swipeOverlayRight) el.swipeOverlayRight.style.opacity = '0';
                    if (el.swipeOverlayUp) el.swipeOverlayUp.style.opacity = '0';
                    if (el.swipeOverlayDown) el.swipeOverlayDown.style.opacity = '0';
                } else {
                    hideAllSwipeOverlays();
                }
            }
        };

        const endDrag = () => {
            if (!previewState.isDragging) return;
            previewState.isDragging = false;
            el.modalCard.classList.remove('is-dragging');
            hideAllSwipeOverlays();

            const dx = previewState.currentX - previewState.startX;
            const dy = previewState.currentY - previewState.startY;
            const dt = Math.max(1, Date.now() - previewState.startTime);
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            const vx = absX / dt;
            const vy = absY / dt;

            const isVerticalSwipe = absY >= absX && (absY >= SWIPE_THRESHOLD || (absY >= 30 && vy >= SWIPE_VELOCITY_THRESHOLD));
            const isHorizontalSwipe = absX > absY && (absX >= SWIPE_THRESHOLD || (absX >= 30 && vx >= SWIPE_VELOCITY_THRESHOLD));

            if (isVerticalSwipe) {
                if (dy < 0) {
                    // Swiped UP -> Next frequently used link
                    navigatePreview(1);
                } else {
                    // Swiped DOWN -> Previous most used target link
                    navigatePreview(-1);
                }
            } else if (isHorizontalSwipe) {
                if (dx > 0) {
                    // Swiped RIGHT -> Open article in Wikipedia
                    openCurrentInWiki();
                } else {
                    // Swiped LEFT -> Analyze ongoing link
                    analyzeCurrentPreviewLink();
                }
            } else {
                springCardBack();
            }
        };

        // Use native touch events for mobile reliability and Pointer Events for
        // mouse input, avoiding duplicate gesture processing on hybrid devices.
        if (window.PointerEvent) {
            el.modalCard.addEventListener('pointerdown', (e) => {
                if (e.pointerType !== 'mouse' || e.button !== 0) return;
                if (e.target.closest('button, a, input, select, textarea')) return;
                startDrag(e.clientX, e.clientY);
                try {
                    el.modalCard.setPointerCapture(e.pointerId);
                } catch (err) {
                    // Pointer capture is optional; the gesture still works without it.
                }
            });
            el.modalCard.addEventListener('pointermove', (e) => moveDrag(e.clientX, e.clientY));
            el.modalCard.addEventListener('pointerup', endDrag);
            el.modalCard.addEventListener('pointercancel', endDrag);
        }
        el.modalCard.addEventListener('touchstart', (e) => {
            const point = getTouchPoint(e);
            if (!point || (e.target && e.target.closest('button, a, input, select, textarea'))) return;
            startDrag(point.clientX, point.clientY);
        }, { passive: true });
        el.modalCard.addEventListener('touchmove', (e) => {
            const point = getTouchPoint(e);
            if (!point) return;
            e.preventDefault();
            moveDrag(point.clientX, point.clientY);
        }, { passive: false });
        el.modalCard.addEventListener('touchend', endDrag, { passive: true });
        el.modalCard.addEventListener('touchcancel', endDrag, { passive: true });

        // Global Keyboard navigation for the preview modal
        document.addEventListener('keydown', (e) => {
            const el = getElements();
            if (!el.previewModal || el.previewModal.classList.contains('hidden')) return;
            if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigatePreview(1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigatePreview(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                openCurrentInWiki();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                analyzeCurrentPreviewLink();
            }
        });
    }

    /**
     * Loads article summary from Wikipedia and launches the preview Modal overlay with swipe gestures
     * @param {string} title - Target link title 
     * @param {number} count - Times linked 
     * @param {string} lang - Language code context
     * @param {Function} onDrillDown - Callback to recursively analyze this link directly from modal
     * @param {Object} [context] - Optional navigation context { links: Array, currentIndex: number }
     */
    async function openLinkPreview(title, count, lang = 'en', onDrillDown, context = {}) {
        const el = getElements();
        if (!el.previewModal) return;

        setupModalGestures();

        previewState.lang = lang || 'en';
        previewState.onDrillDown = onDrillDown;

        // Resolve link list context
        if (context && Array.isArray(context.links) && context.links.length > 0) {
            previewState.links = context.links;
            if (typeof context.currentIndex === 'number' && context.currentIndex >= 0 && context.currentIndex < context.links.length) {
                previewState.currentIndex = context.currentIndex;
            } else {
                const idx = previewState.links.findIndex(l => l.title.toLowerCase() === (title || '').toLowerCase());
                previewState.currentIndex = idx >= 0 ? idx : 0;
            }
        } else {
            previewState.links = [{
                title: title || '',
                count: count || 1,
                url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent((title || '').replace(/ /g, '_'))}`
            }];
            previewState.currentIndex = 0;
        }

        resetCardTransform();
        el.previewModal.classList.remove('hidden');

        await renderCurrentPreview(0);
    }

    /**
     * Hides the article preview modal overlay
     */
    function closeLinkPreview() {
        const el = getElements();
        if (previewState.abortController) {
            previewState.abortController.abort();
            previewState.abortController = null;
        }
        if (el.previewModal) el.previewModal.classList.add('hidden');
        if (el.modalImg) el.modalImg.src = '';
        if (el.modalImgContainer) el.modalImgContainer.classList.add('hidden');
        if (el.modalCard) {
            el.modalCard.classList.remove('swipe-exit-left', 'swipe-exit-right', 'swipe-exit-up', 'swipe-exit-down', 'is-dragging', 'is-recovering');
        }
        resetCardTransform();
        previewState.isDragging = false;
    }

    /**
     * Fetches and renders the Wikipedia Article Summary Preview of the current search/drill query
     * directly on the results page.
     * @param {string} title - Canonical or clean title of the active article
     * @param {string} lang - Language code
     */
    async function renderArticleSummary(title, lang = 'en') {
        const el = getElements();
        if (!el.articleSummaryCard) return;

        const cleanTitle = (title || '').trim();
        if (!cleanTitle) return;

        // Populate base headers immediately
        if (el.articleSummaryTitle) el.articleSummaryTitle.textContent = cleanTitle;
        if (el.articleSummaryLang) el.articleSummaryLang.textContent = (lang || 'en').toUpperCase();
        if (el.articleSummaryWikiLink) {
            el.articleSummaryWikiLink.href = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(cleanTitle.replace(/ /g, '_'))}`;
        }

        // Reset UI states
        if (el.articleSummaryDescription) {
            el.articleSummaryDescription.textContent = '';
            el.articleSummaryDescription.classList.add('hidden');
        }
        if (el.articleSummaryImgContainer) el.articleSummaryImgContainer.classList.add('hidden');
        if (el.articleSummaryImg) el.articleSummaryImg.src = '';
        if (el.articleSummaryLoading) el.articleSummaryLoading.classList.remove('hidden');
        if (el.articleSummaryExtract) {
            el.articleSummaryExtract.textContent = '';
            el.articleSummaryExtract.classList.add('line-clamp-3');
        }
        if (el.articleSummaryToggleBtn) {
            el.articleSummaryToggleBtn.classList.add('hidden');
            el.articleSummaryToggleBtn.innerHTML = `<span>Show more</span> <i class="fa-solid fa-chevron-down text-[9px] ml-0.5"></i>`;
        }

        const cacheKey = `${lang}:${cleanTitle.toLowerCase()}`;
        let summaryData = summaryCache.get(cacheKey);

        if (!summaryData) {
            try {
                const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle.replace(/ /g, '_'))}`);
                if (res.ok) {
                    summaryData = await res.json();
                    summaryCache.set(cacheKey, summaryData);
                } else {
                    summaryData = {
                        title: cleanTitle,
                        extract: 'No summary extract available from Wikipedia for this topic.',
                        description: ''
                    };
                }
            } catch (err) {
                summaryData = {
                    title: cleanTitle,
                    extract: 'Unable to load article summary preview at this time.',
                    description: ''
                };
            }
        }

        if (el.articleSummaryLoading) el.articleSummaryLoading.classList.add('hidden');

        // Apply Description
        if (summaryData.description && el.articleSummaryDescription) {
            el.articleSummaryDescription.textContent = summaryData.description;
            el.articleSummaryDescription.classList.remove('hidden');
        }

        // Apply Extract
        const extractText = summaryData.extract || summaryData.description || 'No extract summary available for this topic.';
        if (el.articleSummaryExtract) {
            el.articleSummaryExtract.textContent = extractText;
        }

        // Apply Thumbnail Image
        if (summaryData.thumbnail && summaryData.thumbnail.source && el.articleSummaryImg && el.articleSummaryImgContainer) {
            el.articleSummaryImg.src = summaryData.thumbnail.source;
            el.articleSummaryImgContainer.classList.remove('hidden');
        }

        // Show Expand/Collapse toggle if text is long enough (> 160 characters)
        if (extractText.length > 160 && el.articleSummaryToggleBtn && el.articleSummaryExtract) {
            el.articleSummaryToggleBtn.classList.remove('hidden');
            el.articleSummaryToggleBtn.onclick = (e) => {
                e.preventDefault();
                const isClamped = el.articleSummaryExtract.classList.contains('line-clamp-3');
                if (isClamped) {
                    el.articleSummaryExtract.classList.remove('line-clamp-3');
                    el.articleSummaryToggleBtn.innerHTML = `<span>Show less</span> <i class="fa-solid fa-chevron-up text-[9px] ml-0.5"></i>`;
                } else {
                    el.articleSummaryExtract.classList.add('line-clamp-3');
                    el.articleSummaryToggleBtn.innerHTML = `<span>Show more</span> <i class="fa-solid fa-chevron-down text-[9px] ml-0.5"></i>`;
                }
            };
        }
    }

    /**
     * Updates the history counter badge in the header.
     * @param {number} count 
     */
    function updateHistoryBadge(count) {
        const el = getElements();
        if (!el.historyCountBadge) return;
        if (count > 0) {
            el.historyCountBadge.textContent = count > 99 ? '99+' : count;
            el.historyCountBadge.classList.remove('hidden');
        } else {
            el.historyCountBadge.classList.add('hidden');
        }
    }

    /**
     * Render the cards inside the History Modal
     */
    function renderHistoryList(sessions, onRestore, onExport, onDelete, query = '') {
        const el = getElements();
        const escape = getEscapeHtml();
        const formatTimeAgo = (global.WikiApp?.utils?.formatTimeAgo) || (() => '');
        if (!el.historyListContainer) return;

        el.historyListContainer.innerHTML = '';

        const cleanQuery = (query || '').toLowerCase().trim();
        const filtered = (sessions || []).filter(s => {
            if (!cleanQuery) return true;
            const matchesTitle = (s.title || '').toLowerCase().includes(cleanQuery);
            const matchesTrail = Array.isArray(s.trail) && s.trail.some(t => t.toLowerCase().includes(cleanQuery));
            return matchesTitle || matchesTrail;
        });

        if (filtered.length === 0) {
            el.historyListContainer.innerHTML = `
                <div class="py-12 text-center text-slate-400 space-y-2">
                    <i class="fa-solid fa-clock-rotate-left text-3xl text-slate-300"></i>
                    <p class="text-xs font-medium text-slate-500">${cleanQuery ? 'No saved sessions matched your search.' : 'No saved analysis sessions in history yet.'}</p>
                    <p class="text-[11px] text-slate-400 max-w-xs mx-auto">
                        ${cleanQuery ? 'Try a different keyword.' : 'Searches and drill-down paths are auto-saved here so you can revisit them anytime.'}
                    </p>
                </div>
            `;
            return;
        }

        filtered.forEach(session => {
            const card = document.createElement('div');
            card.className = 'bg-white border border-slate-200/90 hover:border-blue-300 rounded-xl p-4 shadow-2xs transition-all space-y-3';

            const trailArray = Array.isArray(session.trail) && session.trail.length > 0 ? session.trail : [session.title];
            const timeAgo = formatTimeAgo(session.updatedAt);
            const stepsCount = trailArray.length;

            const trailPills = trailArray.map((t, idx) => {
                const isLast = idx === trailArray.length - 1;
                return `<span class="inline-flex items-center text-[10px] ${isLast ? 'font-bold text-blue-700 bg-blue-50 border border-blue-200/80' : 'text-slate-600 bg-slate-100'} px-2 py-0.5 rounded max-w-[140px] truncate" title="${escape(t)}">${escape(t)}</span>`;
            }).join('<i class="fa-solid fa-chevron-right text-[8px] text-slate-300 mx-1"></i>');

            card.innerHTML = `
                <div class="flex items-start justify-between gap-2">
                    <div class="space-y-1 min-w-0">
                        <div class="flex items-center space-x-2">
                            <span class="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">${escape(session.lang || 'en')}</span>
                            <h4 class="font-bold text-slate-900 text-xs truncate" title="${escape(session.title)}">${escape(session.title)}</h4>
                            <span class="text-[10px] text-slate-400 font-medium">${timeAgo ? '• ' + timeAgo : ''}</span>
                        </div>
                        <div class="flex items-center flex-wrap gap-1 pt-0.5">
                            ${trailPills}
                        </div>
                    </div>
                    <span class="shrink-0 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        ${stepsCount} step${stepsCount > 1 ? 's' : ''}
                    </span>
                </div>

                <div class="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span class="text-[11px] text-slate-500">
                        <span class="font-bold text-slate-700">${(session.totalUnique || 0).toLocaleString()}</span> unique links
                    </span>
                    <div class="flex items-center space-x-1.5">
                        <button type="button" class="history-restore-btn px-2.5 py-1 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-semibold rounded-lg text-xs transition-colors flex items-center space-x-1 cursor-pointer shadow-2xs" data-id="${escape(session.id)}">
                            <i class="fa-solid fa-bolt text-[10px]"></i>
                            <span>Restore</span>
                        </button>
                        <button type="button" class="history-export-btn px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs transition-colors cursor-pointer" data-id="${escape(session.id)}" title="Save session as .json file">
                            <i class="fa-solid fa-download text-xs"></i>
                        </button>
                        <button type="button" class="history-delete-btn px-2 py-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs transition-colors cursor-pointer" data-id="${escape(session.id)}" title="Delete from history">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </div>
            `;

            // Bind card actions
            const restoreBtn = card.querySelector('.history-restore-btn');
            if (restoreBtn) {
                restoreBtn.addEventListener('click', () => {
                    if (typeof onRestore === 'function') onRestore(session);
                });
            }

            const exportBtn = card.querySelector('.history-export-btn');
            if (exportBtn) {
                exportBtn.addEventListener('click', () => {
                    if (typeof onExport === 'function') onExport(session);
                });
            }

            const deleteBtn = card.querySelector('.history-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    if (typeof onDelete === 'function') onDelete(session.id);
                });
            }

            el.historyListContainer.appendChild(card);
        });
    }

    /**
     * Opens the History Modal
     */
    function openHistoryModal(sessions, onRestore, onExport, onDelete, onClearAll, onImportClick) {
        const el = getElements();
        if (!el.historyModal) return;

        el.historyModal.classList.remove('hidden');
        if (el.historySearchInput) el.historySearchInput.value = '';

        renderHistoryList(sessions, onRestore, onExport, onDelete);

        // Bind search input filter
        if (el.historySearchInput) {
            el.historySearchInput.oninput = () => {
                renderHistoryList(sessions, onRestore, onExport, onDelete, el.historySearchInput.value);
            };
        }

        // Bind clear all
        if (el.clearAllHistoryBtn) {
            el.clearAllHistoryBtn.onclick = () => {
                if (confirm('Are you sure you want to delete all saved analysis history?')) {
                    if (typeof onClearAll === 'function') onClearAll();
                }
            };
        }

        // Bind import inside history modal
        if (el.historyImportBtn) {
            el.historyImportBtn.onclick = () => {
                if (typeof onImportClick === 'function') onImportClick();
            };
        }
    }

    /**
     * Closes the History Modal
     */
    function closeHistoryModal() {
        const el = getElements();
        if (el.historyModal) el.historyModal.classList.add('hidden');
    }

    const ui = {
        showLoading: showLoading,
        showError: showError,
        hideError: hideError,
        showCrawlProgress: showCrawlProgress,
        switchTab: switchTab,
        renderBreadcrumbs: renderBreadcrumbs,
        renderArticleSummary: renderArticleSummary,
        renderDashboardStats: renderDashboardStats,
        renderTableBody: renderTableBody,
        renderChart: renderChart,
        renderLinkCloud: renderLinkCloud,
        renderNetworkView: renderNetworkView,
        openLinkPreview: openLinkPreview,
        closeLinkPreview: closeLinkPreview,
        navigatePreview: navigatePreview,
        openCurrentInWiki: openCurrentInWiki,
        analyzeCurrentPreviewLink: analyzeCurrentPreviewLink,
        updateHistoryBadge: updateHistoryBadge,
        renderHistoryList: renderHistoryList,
        openHistoryModal: openHistoryModal,
        closeHistoryModal: closeHistoryModal
    };

    global.WikiApp = global.WikiApp || {};
    global.WikiApp.ui = ui;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ui;
    }
})(typeof window !== 'undefined' ? window : globalThis);


