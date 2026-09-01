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
                previewModal: document.getElementById('previewModal'),
                modalTitle: document.getElementById('modalTitle'),
                modalFreqBadge: document.getElementById('modalFreqBadge'),
                modalWikiUrl: document.getElementById('modalWikiUrl'),
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
     * Switch tabs in the main content card
     * @param {string} tabId - 'table', 'chart', 'cloud'
     */
    function switchTab(tabId) {
        const tabBtnTable = document.getElementById('tabBtnTable');
        const tabBtnChart = document.getElementById('tabBtnChart');
        const tabBtnCloud = document.getElementById('tabBtnCloud');
        const tabContentTable = document.getElementById('tabContentTable');
        const tabContentChart = document.getElementById('tabContentChart');
        const tabContentCloud = document.getElementById('tabContentCloud');

        const btns = [tabBtnTable, tabBtnChart, tabBtnCloud];
        const contents = [tabContentTable, tabContentChart, tabContentCloud];

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
     */
    function renderTableBody(links, maxCount, onPreviewClick) {
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
            tr.className = 'hover:bg-slate-50/80 transition-colors';

            const anchorsSnippet = item.anchorTexts && item.anchorTexts.length > 0 
                ? item.anchorTexts.slice(0, 3).map(a => `<span class="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] mr-1 mb-0.5 max-w-[120px] truncate">${escape(a)}</span>`).join('')
                : '<span class="text-slate-300 italic">Same as title</span>';

            tr.innerHTML = `
                <td class="py-3 px-4 text-center font-semibold text-slate-400">${idx + 1}</td>
                <td class="py-3 px-4 font-semibold text-slate-800">
                    <button type="button" class="preview-trigger text-left hover:text-blue-600 focus:outline-none transition-colors cursor-pointer" data-title="${escape(item.title)}" data-count="${item.count}">
                        ${escape(item.title)}
                    </button>
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

        // Attach click events dynamically
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
     * Loads article summary from Wikipedia and launches the preview Modal overlay
     * @param {string} title - Target link title 
     * @param {number} count - Times linked 
     * @param {string} lang - Language code context
     */
    async function openLinkPreview(title, count, lang = 'en') {
        const el = getElements();
        if (!el.previewModal) return;

        el.previewModal.classList.remove('hidden');
        if (el.modalTitle) el.modalTitle.textContent = title;
        if (el.modalFreqBadge) el.modalFreqBadge.textContent = `${count} mention${count > 1 ? 's' : ''} in source article`;
        if (el.modalWikiUrl) el.modalWikiUrl.href = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

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
        switchTab: switchTab,
        renderDashboardStats: renderDashboardStats,
        renderTableBody: renderTableBody,
        renderChart: renderChart,
        renderLinkCloud: renderLinkCloud,
        openLinkPreview: openLinkPreview,
        closeLinkPreview: closeLinkPreview
    };

    global.WikiApp = global.WikiApp || {};
    global.WikiApp.ui = ui;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ui;
    }
})(typeof window !== 'undefined' ? window : globalThis);

