# Wikipedia Outgoing Link Frequency Analyzer

A modern, responsive, client-side web application designed to extract, analyze, rank, and visualize outgoing internal links from any Wikipedia article across multiple language subdomains.

The application leverages the official **MediaWiki Action API** to fetch live parsed HTML pages, analyzes anchor tags using high-performance DOM querying, and maps the frequency distribution of linked topics.

---

## 🏗️ Architecture

It utilizes native ES Modules (ESM) for modularity, clean component boundaries, and straightforward expandability.

```
/wolfa/
├── index.html                           # Main HTML layout, CDN configurations & entrypoint
├── README.md                            # Comprehensive project overview and developer manual
├── css/
│   └── styles.css                       # Custom visual elements (custom scrollbar & fonts)
└── js/
    ├── app.js                           # State Coordinator (orchestrates UI, events, and logic)
    ├── parser.js                        # MediaWiki API integration and custom DOM parsing logic
    ├── ui.js                            # UI Render controller (Dashboard stats, Tables, Charts, Modals)
    └── utils.js                         # Generic, stateless common helpers (escaping, file savers)
```

---

## 🛠️ File Responsibilities

### 1. `index.html`
* Serves as the application skeleton.
* Handles CDNs for layout libraries: [Tailwind CSS](https://tailwindcss.com/) (UI & layout styling), [FontAwesome](https://fontawesome.com/) (vector icons), and [Chart.js](https://chartjs.org/) (graphing).
* Binds the application code via `<script type="module" src="js/app.js"></script>`.

### 2. `css/styles.css`
* Implements beautiful `@import` typography from Google Fonts (Inter).
* Configures scrollbar behavior and responsiveness aesthetics.

### 3. `js/app.js` (The Controller)
* Coordinates application state (`currentAnalysisData`, `filteredLinks`, `currentSort`).
* Instantiates event listeners (form submissions, input clearances, presets, tab switching, and file exports).
* Glues parser operations to visual updates by listening for query mutations and immediately scheduling a dashboard reflow.

### 4. `js/parser.js` (The Engine)
* Standardizes inputs (accepting either raw titles or fully qualified URL strings).
* Targets the correct MediaWiki Action API endpoint with native CORS capabilities (`origin=*`).
* Parses incoming parsed-JSON raw HTML fragments using the browser's high-speed `DOMParser`.
* Filters out custom namespaces (e.g., `Category:`, `Help:`, `File:`) and system wrappers (like navigation footers or infoboxes) based on advanced checkbox preferences.
* Compiles a sorted frequency distribution array complete with anchor text variations.

### 5. `js/ui.js` (The View)
* Redraws state elements cleanly inside the page DOM.
* Manages the lifecycle of the **Chart.js** instance, properly destroying old graphs before painting new datasets.
* Renders a weighted, interactive **Word Cloud** representing topic importance.
* Integrates with Wikipedia REST APIs to fetch modal previews with summaries and article thumbnail previews dynamically on user click.

### 6. `js/utils.js` (Utilities)
* Provides `escapeHtml` for robust cross-site scripting (XSS) sanitation when inserting user/scraped text into the DOM.
* Powers the exporter engine with safe URI/Blob local downloads (`downloadFile`).
* Leverages system pasteboards for list-to-clipboard copying.
* Manages UI toast alert durations.

---

## 🚀 Getting Started

The application is built with universal browser compatibility and can be launched immediately:

### Option A: Direct Open (Zero Setup)
Simply double-click `index.html` in your file explorer to open the application directly in any modern web browser (`file:///` protocol supported out of the box).

### Option B: Running with a Local Server
To serve the directory using a lightweight HTTP server:

#### Using Python (Built-in)
```bash
python -m http.server 8000
```
Then open your browser to: [http://localhost:8000](http://localhost:8000)

#### Using Node.js
```bash
npx serve .
```
Then open your browser to: [http://localhost:3000](http://localhost:3000)

---

## 🎯 Key Features Included

1. **Flexible Input Recognition**: Works with full URL addresses (e.g. `https://es.wikipedia.org/wiki/Sol`) or raw subject titles (e.g. `Solar System`).
2. **Interactive 1-Click Recursive Drill-Down (`⚡`)**:
   - Drill into any outgoing link directly from the table row, link cloud, or preview modal without retyping search queries.
   - Built-in **Breadcrumb Trail & History Navigation** (`[Root] > [Child 1] > [Child 2]`) to effortlessly jump back and forth with zero latency.
   - Smart in-memory LRU caching to eliminate redundant network roundtrips.
3. **Automated 2-Level Batch Deep Crawl & Network Analysis**:
   - Recursively crawls top $N$ outgoing links in batch with live progress tracking and polite concurrency throttling.
   - Aggregates **Second-Order Central Topic Hubs** to identify cross-referencing connections across entire subject clusters.
4. **Deep Filter Controls**: Instantly toggles the inclusion of heavy side-elements (Infoboxes, Sidebars, Reference footers, and Navboxes) to keep analytics highly accurate.
5. **Advanced Tabbed Views**:
   * **Ranked Links Table**: Fast search, minimum link frequency slider filters, column sorting, and quick-drill buttons.
   * **Frequency Bar Chart**: Graphing top-20 target links by instance count.
   * **Weighted Word Cloud**: Visually renders link gravity with responsive click behavior.
   * **Deep Crawl & Network**: Cluster cards, 2nd-order hub distribution, and cross-cluster density metrics.
6. **Interactive Summary Previews**: Clicking on any target launches an overlay modal querying the Wikipedia REST Summary API, loading thumbnail graphics, extracts, and a direct `Analyze Outgoing Links` drill-down button.
7. **One-Click Exports**: Download link frequency tables and cluster network metadata directly as `.csv` or `.json`, or copy a formatted Markdown list to clipboard.

---

## 📈 Future Scalability Path

This organized structure enables easy integration paths for several next-generation features:

* **Caching Layer**: Integrating `IndexedDB` or `localStorage` inside `js/parser.js` to cache past wiki scrapes, speeding up comparative analyses and reducing Wikipedia API hits.
* **Crawl Path Analysis**: Enhancing `js/parser.js` to recursively query outbound links (2-levels deep) to map second-order connections and display graph network visualization nodes.
* **Modern Tooling**: Easily convert to a TypeScript-compiled application or install bundling tooling like **Vite** or **Webpack** for production-ready asset compression and linting controls.
