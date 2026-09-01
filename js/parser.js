/**
 * MediaWiki API integration and page content parser.
 */
(function (global) {
    'use strict';

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
     * @returns {Promise<Object>} Analyzed article data
     */
    async function analyzeWikipediaLinks(inputStr, defaultLang = 'en', options = {}) {
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

        return {
            title: canonicalTitle,
            lang: lang,
            links: resultArray,
            totalUnique: resultArray.length,
            totalOccurrences: totalOccurrences
        };
    }

    const parser = {
        analyzeWikipediaLinks: analyzeWikipediaLinks
    };

    global.WikiApp = global.WikiApp || {};
    global.WikiApp.parser = parser;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = parser;
    }
})(typeof window !== 'undefined' ? window : globalThis);

