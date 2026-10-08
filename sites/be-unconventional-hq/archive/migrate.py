import re
import os

with open('src/styles/global.css', 'r') as f:
    css = f.read()

def extract_and_remove(start_marker, end_marker=None):
    global css
    if end_marker:
        pattern = re.compile(rf'({start_marker}.*?)(?={end_marker}|\Z)', re.DOTALL)
    else:
        pattern = re.compile(rf'({start_marker}.*)', re.DOTALL)
    
    match = pattern.search(css)
    if match:
        content = match.group(1)
        css = css.replace(content, '')
        return content
    return ""

def append_to_astro(file_path, style_content):
    if not style_content.strip(): return
    if not os.path.exists(file_path):
        print(f"Warning: {file_path} not found.")
        return
    with open(file_path, 'r') as f:
        content = f.read()
    
    if '<style>' not in content:
        content += f'\n<style>\n{style_content.strip()}\n</style>\n'
    else:
        content = content.replace('</style>', f'\n{style_content.strip()}\n</style>')
        
    with open(file_path, 'w') as f:
        f.write(content)

# Define blocks
navbar_css = extract_and_remove(r'/\* ━━━+ NAVBAR', r'/\* ━━━+ SECTIONS \+ CATEGORIES')
cat_css = extract_and_remove(r'/\* ━━━+ SECTIONS \+ CATEGORIES', r'/\* ━━━+ SCROLL ANIMATION')
scroll_css = extract_and_remove(r'/\* ━━━+ SCROLL ANIMATION', r'/\* ━━━+ FOOTER')
footer_css = extract_and_remove(r'/\* ━━━+ FOOTER', r'/\* ━━━+ FILTER / SELECTOR UI')
filter_css = extract_and_remove(r'/\* ━━━+ FILTER / SELECTOR UI', r'/\* ━━━+ VIDEOS PAGE')
videos_css = extract_and_remove(r'/\* ━━━+ VIDEOS PAGE', r'/\* ━━━+ ARTICLES PAGE')
articles_css = extract_and_remove(r'/\* ━━━+ ARTICLES PAGE', r'/\* ━━━+ ABOUT PAGE')
about_css = extract_and_remove(r'/\* ━━━+ ABOUT PAGE', r'/\* ━━━+ CONTACT PAGE')
contact_css = extract_and_remove(r'/\* ━━━+ CONTACT PAGE', r'/\* ━━━+ EVENTS PAGE')
events_css = extract_and_remove(r'/\* ━━━+ EVENTS PAGE', r'/\* ━━━+ LATEST ARTICLES SECTION')
latest_css = extract_and_remove(r'/\* ━━━+ LATEST ARTICLES SECTION')

# The remaining CSS is global base
with open('src/styles/global-base.css', 'w') as f:
    f.write(css)

# Update layout to import global-base.css instead of global.css
with open('src/layouts/Layout.astro', 'r') as f:
    layout = f.read()
layout = layout.replace("import '../styles/global.css';", "import '../styles/global-base.css';")
with open('src/layouts/Layout.astro', 'w') as f:
    f.write(layout)

# Distribute styles
append_to_astro('src/components/Navbar.astro', navbar_css)
append_to_astro('src/components/Footer.astro', footer_css)
append_to_astro('src/components/Categories.astro', cat_css)
append_to_astro('src/components/LatestArticles.astro', latest_css)
append_to_astro('src/pages/videos.astro', videos_css)
append_to_astro('src/pages/articles.astro', articles_css)
append_to_astro('src/pages/events.astro', events_css)
append_to_astro('src/pages/contact.astro', contact_css)
append_to_astro('src/pages/about.astro', about_css)
# Appending filter css to common places or layout?
# Filter UI is shared across videos, articles, events, feed. Let's put it in a common component or global-base for now, or copy to each.
# For now, put filter_css in global-base.css to avoid duplicating across 4 pages.
with open('src/styles/global-base.css', 'a') as f:
    f.write(f"\n{filter_css}\n")
    f.write(f"\n{scroll_css}\n") # Scroll animations also shared

# Wait, the hero CSS was inside NAVBAR? Let's check where .hero is.
