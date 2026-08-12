const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

// Configure marked options if needed (e.g. for custom styling or security)
marked.setOptions({
  gfm: true,
  breaks: true
});

const POSTS_DIR = path.join(__dirname, '_posts');
const LAYOUTS_DIR = path.join(__dirname, '_layouts');
const OUTPUT_DIR = path.join(__dirname, 'posts');
const INDEX_PATH = path.join(__dirname, 'index.html');

function build() {
  console.log('Starting build...');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
  }

  // Load post layout
  const layoutPath = path.join(LAYOUTS_DIR, 'post.html');
  if (!fs.existsSync(layoutPath)) {
    console.error(`Layout template not found at: ${layoutPath}`);
    process.exit(1);
  }
  const postLayout = fs.readFileSync(layoutPath, 'utf8');

  // Read all markdown files in _posts
  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
    console.log(`Created posts source directory: ${POSTS_DIR}. Please add some markdown files.`);
    return;
  }

  const files = fs.readdirSync(POSTS_DIR).filter(file => file.endsWith('.md'));
  const postsMetadata = [];

  files.forEach(file => {
    const filePath = path.join(POSTS_DIR, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Parse YAML front matter and markdown body
    const { data: frontMatter, content: markdownBody } = matter(fileContent);

    // Render Markdown to HTML
    const htmlContent = marked.parse(markdownBody);

    // Determine slug (remove date prefix if present, e.g. 2026-06-02-my-post.md -> my-post)
    const fileNameWithoutExt = path.basename(file, '.md');
    const slugMatch = fileNameWithoutExt.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
    const slug = slugMatch ? slugMatch[1] : fileNameWithoutExt;

    const postFileName = `${slug}.html`;
    const postOutputPath = path.join(OUTPUT_DIR, postFileName);

    // Apply layout template
    let renderedHtml = postLayout
      .replace(/\{\{title\}\}/g, frontMatter.title || 'Untitled')
      .replace(/\{\{subtitle\}\}/g, frontMatter.subtitle || '')
      .replace(/\{\{date\}\}/g, frontMatter.display_date || frontMatter.date || '')
      .replace(/\{\{type\}\}/g, frontMatter.type || 'Essay')
      .replace(/\{\{content\}\}/g, htmlContent);

    // Write generated HTML file
    fs.writeFileSync(postOutputPath, renderedHtml, 'utf8');
    console.log(`Compiled: ${file} -> posts/${postFileName}`);

    // Store metadata for index.html integration
    postsMetadata.push({
      title: frontMatter.title || 'Untitled',
      description: frontMatter.description || frontMatter.subtitle || '',
      date: frontMatter.date || '1970-01-01',
      display_date: frontMatter.display_date || frontMatter.date || '',
      type: frontMatter.type || 'Essay',
      category: frontMatter.category || 'research',
      url: `posts/${postFileName}`
    });
  });

  // Sort posts by date (descending)
  postsMetadata.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Separate posts by category
  const researchPosts = postsMetadata.filter(post => post.category === 'research');
  const opinionPosts = postsMetadata.filter(post => post.category === 'opinion');

  // Helper to construct HTML listings for a list of posts
  function buildListHtml(posts, isRootPath, emptyPlaceholder) {
    if (posts.length === 0) {
      return emptyPlaceholder;
    }
    return posts.map(post => {
      const url = isRootPath ? post.url : path.basename(post.url);
      return `          <div class="research-item">
            <div class="research-meta">
              <span class="research-type">${post.type}</span>
              <span>${post.display_date}</span>
            </div>
            <h3 class="research-title"><a href="${url}">${post.title}</a></h3>
            <p class="research-desc">${post.description}</p>
          </div>`;
    }).join('\n\n');
  }

  // The home page uses a different, editorial listing treatment from the archive.
  function buildJournalListHtml(posts, emptyPlaceholder) {
    if (posts.length === 0) {
      return emptyPlaceholder;
    }
    return posts.map(post => `      <div class="journal-entry">
        <div class="je-meta">
          <span class="je-type">${post.type}</span>
          <span class="je-date">${post.display_date}</span>
        </div>
        <div class="je-body">
          <h3 class="je-title"><a href="${post.url}">${post.title}</a></h3>
          <p class="je-abstract">${post.description}</p>
          <span class="je-status">Published &middot; Read essay &rarr;</span>
        </div>
      </div>`).join('\n\n');
  }

  // Define empty placeholders
  const researchPlaceholder = `      <div class="journal-entry">
        <div class="je-meta">
          <span class="je-type">Essay &middot; Data</span>
          <span class="je-date">Forthcoming</span>
        </div>
        <div class="je-body">
          <h3 class="je-title">An investigation into the standardisation of public audio infrastructure</h3>
          <p class="je-abstract">A long-form piece on the institutions, specifications, and quiet gaps that shape how public audio is measured, archived, and forgotten. To be published as the inaugural entry in this section.</p>
          <span class="je-status">In production</span>
        </div>
      </div>`;

  const opinionsPlaceholder = `      <div class="journal-entry">
        <div class="je-meta">
          <span class="je-type">Status</span>
          <span class="je-date">2026</span>
        </div>
        <div class="je-body">
          <h3 class="je-title">Coming soon</h3>
          <p class="je-abstract">Reflections and thought pieces are on the way. Check back soon.</p>
        </div>
      </div>`;

  // Build research section list items for index.html (root directory URLs)
  const researchListHtml = buildJournalListHtml(researchPosts, researchPlaceholder);
  const opinionsListHtml = buildJournalListHtml(opinionPosts, opinionsPlaceholder);

  // Update index.html
  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`index.html not found at: ${INDEX_PATH}`);
    process.exit(1);
  }

  let indexContent = fs.readFileSync(INDEX_PATH, 'utf8');

  // Regex to match and replace between <!-- RESEARCH_START --> and <!-- RESEARCH_END -->
  const researchRegex = /(<!--\s*RESEARCH_START\s*-->)([\s\S]*?)(<!--\s*RESEARCH_END\s*-->)/i;
  // Regex to match and replace between <!-- OPINIONS_START --> and <!-- OPINIONS_END -->
  const opinionsRegex = /(<!--\s*OPINIONS_START\s*-->)([\s\S]*?)(<!--\s*OPINIONS_END\s*-->)/i;

  if (researchRegex.test(indexContent)) {
    indexContent = indexContent.replace(researchRegex, `$1\n${researchListHtml}\n      $3`);
    console.log('Successfully updated research section in index.html!');
  }

  if (opinionsRegex.test(indexContent)) {
    indexContent = indexContent.replace(opinionsRegex, `$1\n${opinionsListHtml}\n      $3`);
    console.log('Successfully updated opinions section in index.html!');
  }

  fs.writeFileSync(INDEX_PATH, indexContent, 'utf8');

  // --- Build archive index (posts/index.html) ---
  const archiveLayoutPath = path.join(LAYOUTS_DIR, 'archive.html');
  if (fs.existsSync(archiveLayoutPath)) {
    const archiveLayout = fs.readFileSync(archiveLayoutPath, 'utf8');

    // Archive page list includes all posts chronologically
    const archivePlaceholder = `            <div class="research-item">
              <div class="research-meta">
                <span class="research-type">Status</span>
                <span>2026</span>
              </div>
              <h3 class="research-title"><a href="#">Coming soon</a></h3>
              <p class="research-desc">Check back soon for new research, essays, and analysis entries.</p>
            </div>`;

    const archiveListHtml = buildListHtml(postsMetadata, false, archivePlaceholder);
    const renderedArchive = archiveLayout.replace(/\{\{content\}\}/g, archiveListHtml);

    const archiveOutputPath = path.join(OUTPUT_DIR, 'index.html');
    fs.writeFileSync(archiveOutputPath, renderedArchive, 'utf8');
    console.log('Successfully compiled archive page: posts/index.html');
  } else {
    console.warn('WARNING: archive.html layout not found. posts/index.html was not generated.');
  }

  console.log('Build completed successfully!');
}

build();
