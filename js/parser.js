/**
 * MediaWiki API integration, in-memory caching, and recursive cluster crawler.
 */
(function (global) {
    'use strict';

    /**
     * In-memory cache for analyzed articles to provide zero-latency drill-down & history navigation.
     * Key: `${lang}:${normalizedTitle.toLowerCase()}`
     */
    const analysisCache = new Map();

    /**
     * Multilingual ignored namespace prefixes (lowercase) to filter out non-article links.
     */
    const IGNORED_PREFIXES = [
        // Standard English namespaces
        'file:', 'category:', 'wikipedia:', 'help:', 'template:', 'template_talk:',
        'special:', 'talk:', 'portal:', 'draft:', 'module:', 'media:', 'user:',
        // Common international namespaces (Spanish, French, German, Italian, Portuguese, Russian, etc.)
        'categoría:', 'catégorie:', 'categoria:', 'kategorie:', 'категория:',
        'archivo:', 'fichier:', 'datei:', 'file:', 'файл:',
        'ayuda:', 'aide:', 'hilfe:', 'aiuto:', 'ajuda:', 'справка:',
        'plantilla:', 'modèle:', 'vorlage:', 'predefinição:', 'шаблон:',
        'especial:', 'spécial:', 'spezial:', 'speciale:', 'служебная:',
        'usuario:', 'utilisateur:', 'benutzer:', 'utente:', 'usuário:', 'участник:',
        'discusión:', 'discussion:', 'diskussion:', 'discussione:', 'discussão:', 'обсуждение:',
        'anexo:', 'portail:', 'portale:', 'portal:', 'портал:'
    ];

    /**
     * Core Parser Algorithm.
     * Extracts, cleans and ranks outgoing internal links from a given Wikipedia article.
     * 
     * @param {string} inputStr - Wikipedia URL or Article Title
     * @param {string} defaultLang - Default language code (e.g. 'en')
     * @param {Object} options - Filtering options (excludeNav, excludeInfobox)
     * @param {boolean} forceRefresh - If true, bypasses the in-memory cache
     * @returns {Promise<Object>} Analyzed article data
     */
    async function analyzeWikipediaLinks(inputStr, defaultLang = 'en', options = {}, forceRefresh = false) {
        let cleanInput = (inputStr || '').trim();
        if (!cleanInput) {
            throw new Error('Please enter a Wikipedia article title or URL.');
        }

        let pageTitle = cleanInput;
        let lang = defaultLang || 'en';

        // Extract language & title if user pasted a complete or partial Wikipedia URL
        if (pageTitle.includes('wikipedia.org/wiki/')) {
            let urlStringToParse = pageTitle;
            if (!/^https?:\/\//i.test(urlStringToParse)) {
                urlStringToParse = 'https://' + urlStringToParse;
            }

            try {
                const parsedUrl = new URL(urlStringToParse);
                const hostParts = parsedUrl.hostname.split('.');
                if (hostParts.length >= 3 && hostParts[0].length >= 2) {
                    lang = hostParts[0];
                }
                pageTitle = parsedUrl.pathname.replace(/^\/wiki\//, '');
            } catch (e) {
                const match = pageTitle.match(/([a-z]{2,})\.wikipedia\.org\/wiki\/([^?#]+)/i);
                if (match) {
                    lang = match[1];
                    pageTitle = match[2];
                } else {
                    pageTitle = pageTitle.replace(/.*\/wiki\//, '');
                }
            }
        }

        // Strip hash fragments and URL queries if any remain
        pageTitle = pageTitle.split('#')[0].split('?')[0];

        // Standardize spaces & URI components
        try {
            pageTitle = decodeURIComponent(pageTitle).replace(/_/g, ' ').trim();
        } catch (e) {
            pageTitle = pageTitle.replace(/_/g, ' ').trim();
        }

        if (!pageTitle) {
            throw new Error('Invalid article title specified.');
        }

        const cacheKey = `${lang}:${pageTitle.toLowerCase()}:${options.excludeNav !== false}:${options.excludeInfobox !== false}`;
        if (!forceRefresh && analysisCache.has(cacheKey)) {
            return analysisCache.get(cacheKey);
        }

        // Query MediaWiki Action API with redirects followed and CORS (origin=*)
        const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&redirects=1&prop=text|title&format=json&origin=*`;

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}: Failed to reach Wikipedia API`);
        }

        const json = await response.json();
        if (json.error) {
            throw new Error(json.error.info || 'Wikipedia article not found.');
        }

        if (!json.parse || !json.parse.text) {
            throw new Error('Wikipedia returned an unexpected empty response.');
        }

        const htmlContent = json.parse.text['*'] || '';
        const canonicalTitle = json.parse.title || pageTitle;

        // Parse DOM string
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const container = doc.body;

        // Filter out navigation elements if checked
        if (options.excludeNav) {
            container.querySelectorAll(
                '.navbox, .vertical-navbox, .catlinks, .reflist, .navbox-inner, .sisterbar, .mw-cite-backlink, .citation, .reference'
            ).forEach(el => el.remove());
        }

        // Filter out infoboxes if checked
        if (options.excludeInfobox) {
            container.querySelectorAll('.infobox, .sidebar, .vertical-header').forEach(el => el.remove());
        }

        // Find all outgoing internal wiki links
        const anchorElements = container.querySelectorAll('a[href^="/wiki/"]');
        const frequencyMap = new Map();

        anchorElements.forEach(a => {
            // Skip images or file links with image classes
            if (a.classList.contains('image') || a.classList.contains('mw-file-description')) {
                return;
            }

            const rawHref = a.getAttribute('href');
            if (!rawHref) return;

            // Remove fragment identifiers (#section) and queries
            const pathNoHash = rawHref.split('#')[0].split('?')[0];
            const cleanTargetRaw = pathNoHash.replace(/^\/wiki\//, '');
            if (!cleanTargetRaw) return;

            let targetTitle;
            try {
                targetTitle = decodeURIComponent(cleanTargetRaw).replace(/_/g, ' ').trim();
            } catch (e) {
                targetTitle = cleanTargetRaw.replace(/_/g, ' ').trim();
            }

            if (!targetTitle) return;

            const lowerTarget = targetTitle.toLowerCase();

            // Check ignored namespaces and self reference
            const isIgnored = IGNORED_PREFIXES.some(prefix => lowerTarget.startsWith(prefix));
            if (isIgnored || lowerTarget === canonicalTitle.toLowerCase()) {
                return;
            }

            const anchorText = a.textContent.trim();

            if (!frequencyMap.has(targetTitle)) {
                frequencyMap.set(targetTitle, {
                    title: targetTitle,
                    count: 0,
                    anchorTexts: new Set(),
                    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(targetTitle.replace(/ /g, '_'))}`
                });
            }

            const item = frequencyMap.get(targetTitle);
            item.count += 1;
            if (anchorText && anchorText.length < 60) {
                item.anchorTexts.add(anchorText);
            }
        });

        // Convert map to sorted array
        const resultArray = Array.from(frequencyMap.values()).map(item => ({
            ...item,
            anchorTexts: Array.from(item.anchorTexts)
        })).sort((a, b) => b.count - a.count);

        const totalOccurrences = resultArray.reduce((acc, curr) => acc + curr.count, 0);

        const result = {
            title: canonicalTitle,
            lang: lang,
            links: resultArray,
            totalUnique: resultArray.length,
            totalOccurrences: totalOccurrences,
            analyzedAt: new Date().toISOString()
        };

        // Cache the canonical result
        const canonicalKey = `${lang}:${canonicalTitle.toLowerCase()}:${options.excludeNav !== false}:${options.excludeInfobox !== false}`;
        analysisCache.set(cacheKey, result);
        analysisCache.set(canonicalKey, result);

        return result;
    }

    /**
     * Batch concurrency helper to run asynchronous tasks with a maximum pool size.
     * @param {Array<Function>} tasks - Array of async functions returning a promise
     * @param {number} concurrency - Max simultaneous active tasks
     * @returns {Promise<Array>} Results in original order
     */
    async function runConcurrent(tasks, concurrency = 3) {
        const results = new Array(tasks.length);
        let currentIndex = 0;

        async function worker() {
            while (currentIndex < tasks.length) {
                const index = currentIndex++;
                try {
                    results[index] = await tasks[index]();
                } catch (err) {
                    results[index] = { error: err };
                }
            }
        }

        const workers = [];
        const poolSize = Math.min(concurrency, tasks.length);
        for (let i = 0; i < poolSize; i++) {
            workers.push(worker());
        }
        await Promise.all(workers);
        return results;
    }

    /**
     * Recursively crawls the top N outgoing links of a given article to perform
     * a 2-level cluster analysis and extract second-order hub frequencies.
     * 
     * @param {string|Object} rootInput - Article title/URL or already analyzed root data
     * @param {string} defaultLang - Language code
     * @param {number} topN - Number of top outgoing links to recursively parse (e.g. 5, 10)
     * @param {Object} options - Parser options (excludeNav, excludeInfobox)
     * @param {Function} onProgress - Callback: ({ current, total, targetTitle, percent })
     * @returns {Promise<Object>} Cluster analysis result
     */
    async function analyzeRecursiveCluster(rootInput, defaultLang = 'en', topN = 5, options = {}, onProgress = () => {}) {
        let rootData;
        if (typeof rootInput === 'object' && rootInput.links) {
            rootData = rootInput;
        } else {
            rootData = await analyzeWikipediaLinks(rootInput, defaultLang, options);
        }

        const subTargets = rootData.links.slice(0, Math.max(1, topN));
        const total = subTargets.length;
        let completed = 0;

        onProgress({
            current: 0,
            total: total,
            targetTitle: 'Initializing recursive cluster crawl...',
            percent: 0
        });

        // Prepare crawl tasks for each sub-target
        const tasks = subTargets.map((subItem, index) => {
            return async () => {
                onProgress({
                    current: completed,
                    total: total,
                    targetTitle: subItem.title,
                    percent: Math.round((completed / total) * 100)
                });

                try {
                    const data = await analyzeWikipediaLinks(subItem.title, rootData.lang, options);
                    completed++;
                    onProgress({
                        current: completed,
                        total: total,
                        targetTitle: subItem.title,
                        percent: Math.round((completed / total) * 100)
                    });
                    return {
                        title: subItem.title,
                        url: subItem.url,
                        originalRank: index + 1,
                        rootMentionCount: subItem.count,
                        data: data,
                        error: null
                    };
                } catch (err) {
                    completed++;
                    onProgress({
                        current: completed,
                        total: total,
                        targetTitle: subItem.title,
                        percent: Math.round((completed / total) * 100)
                    });
                    return {
                        title: subItem.title,
                        url: subItem.url,
                        originalRank: index + 1,
                        rootMentionCount: subItem.count,
                        data: null,
                        error: err.message || 'Failed to parse'
                    };
                }
            };
        });

        // Run with concurrency of 3 to stay polite to Wikipedia servers
        const subResults = await runConcurrent(tasks, 3);

        // Aggregate second-order connections
        // Map: targetTitle -> { title, url, totalOccurrences, subArticleCount, sharedBy: [] }
        const secondOrderMap = new Map();
        const rootTitleLower = rootData.title.toLowerCase();
        const subTitlesSet = new Set(subTargets.map(s => s.title.toLowerCase()));

        let internalCrossLinksCount = 0;

        subResults.forEach(sub => {
            if (!sub.data || !sub.data.links) return;

            sub.data.links.forEach(outLink => {
                const lower = outLink.title.toLowerCase();

                // Track if sub-article links to another sub-article in the top N set
                if (subTitlesSet.has(lower)) {
                    internalCrossLinksCount += outLink.count;
                }

                // Exclude links back to the root article from 2nd-order hubs
                if (lower === rootTitleLower) return;

                if (!secondOrderMap.has(outLink.title)) {
                    secondOrderMap.set(outLink.title, {
                        title: outLink.title,
                        url: outLink.url,
                        totalOccurrences: 0,
                        subArticleCount: 0,
                        sharedBy: []
                    });
                }

                const entry = secondOrderMap.get(outLink.title);
                entry.totalOccurrences += outLink.count;
                entry.subArticleCount += 1;
                entry.sharedBy.push({
                    subTitle: sub.title,
                    count: outLink.count
                });
            });
        });

        // Sort hubs by how many sub-articles link to them (cluster centrality), then total frequency
        const secondOrderHubs = Array.from(secondOrderMap.values()).sort((a, b) => {
            if (b.subArticleCount !== a.subArticleCount) {
                return b.subArticleCount - a.subArticleCount;
            }
            return b.totalOccurrences - a.totalOccurrences;
        });

        const totalSecondOrderOccurrences = secondOrderHubs.reduce((acc, curr) => acc + curr.totalOccurrences, 0);

        return {
            rootData: rootData,
            lang: rootData.lang,
            subArticles: subResults,
            secondOrderHubs: secondOrderHubs,
            totalSecondOrderUnique: secondOrderHubs.length,
            totalSecondOrderOccurrences: totalSecondOrderOccurrences,
            internalCrossLinksCount: internalCrossLinksCount,
            crawledCount: subResults.filter(s => s.data).length,
            totalRequested: total,
            analyzedAt: new Date().toISOString()
        };
    }

    /**
     * Clear all cached article analyses
     */
    function clearCache() {
        analysisCache.clear();
    }

    const parser = {
        analyzeWikipediaLinks: analyzeWikipediaLinks,
        analyzeRecursiveCluster: analyzeRecursiveCluster,
        clearCache: clearCache,
        analysisCache: analysisCache
    };

    global.WikiApp = global.WikiApp || {};
    global.WikiApp.parser = parser;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = parser;
    }
})(typeof window !== 'undefined' ? window : globalThis);


