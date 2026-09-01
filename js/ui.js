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
                modalTitle: document.getElementById('modalTitle'),
                modalFreqBadge: document.getElementById('modalFreqBadge'),
                modalWikiUrl: document.getElementById('modalWikiUrl'),
                modalDrillBtn: document.getElementById('modalDrillBtn'),
                modalLoading: document.getElementById('modalLoading'),
                modalBody: document.getElementById('modalBody'),
                modalImg: document.getElementById('modalImg'),
                modalImgContainer: document.getElementById('modalImgContainer'),
                modalExtract: document.getElementById('modalExtract'),
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

    /**
     * Loads article summary from Wikipedia and launches the preview Modal overlay
     * @param {string} title - Target link title 
     * @param {number} count - Times linked 
     * @param {string} lang - Language code context
     * @param {Function} onDrillDown - Callback to recursively analyze this link directly from modal
     */
    async function openLinkPreview(title, count, lang = 'en', onDrillDown) {
        const el = getElements();
        if (!el.previewModal) return;

        el.previewModal.classList.remove('hidden');
        if (el.modalTitle) el.modalTitle.textContent = title;
        if (el.modalFreqBadge) el.modalFreqBadge.textContent = `${count} mention${count > 1 ? 's' : ''} in source article`;
        if (el.modalWikiUrl) el.modalWikiUrl.href = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

        if (el.modalDrillBtn) {
            // Replace click listener cleanly
            const newDrillBtn = el.modalDrillBtn.cloneNode(true);
            el.modalDrillBtn.parentNode.replaceChild(newDrillBtn, el.modalDrillBtn);
            cachedElements.modalDrillBtn = newDrillBtn;
            newDrillBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeLinkPreview();
                if (typeof onDrillDown === 'function') {
                    onDrillDown(title);
                }
            });
        }

        if (el.modalLoading) el.modalLoading.classList.remove('hidden');
        if (el.modalBody) el.modalBody.classList.add('hidden');
        if (el.modalImgContainer) el.modalImgContainer.classList.add('hidden');
        if (el.modalImg) el.modalImg.src = '';

        try {
            const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
            if (res.ok) {
                const data = await res.json();
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
        } catch (e) {
            if (el.modalExtract) el.modalExtract.textContent = 'Failed to load Wikipedia summary preview.';
        } finally {
            if (el.modalLoading) el.modalLoading.classList.add('hidden');
            if (el.modalBody) el.modalBody.classList.remove('hidden');
        }
    }

    /**
     * Hides the article preview modal overlay
     */
    function closeLinkPreview() {
        const el = getElements();
        if (el.previewModal) el.previewModal.classList.add('hidden');
        if (el.modalImg) el.modalImg.src = '';
        if (el.modalImgContainer) el.modalImgContainer.classList.add('hidden');
    }

    const ui = {
        showLoading: showLoading,
        showError: showError,
        hideError: hideError,
        showCrawlProgress: showCrawlProgress,
        switchTab: switchTab,
        renderBreadcrumbs: renderBreadcrumbs,
        renderDashboardStats: renderDashboardStats,
        renderTableBody: renderTableBody,
        renderChart: renderChart,
        renderLinkCloud: renderLinkCloud,
        renderNetworkView: renderNetworkView,
        openLinkPreview: openLinkPreview,
        closeLinkPreview: closeLinkPreview
    };

    global.WikiApp = global.WikiApp || {};
    global.WikiApp.ui = ui;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ui;
    }
})(typeof window !== 'undefined' ? window : globalThis);


