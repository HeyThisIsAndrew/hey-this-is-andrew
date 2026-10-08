import os

def insert_import(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if "import Button" not in content:
        # insert after the first import
        content = content.replace(
            "import Layout from '../layouts/Layout.astro';",
            "import Layout from '../layouts/Layout.astro';\nimport Button from '../components/Button.astro';"
        )
        with open(filepath, 'w') as f:
            f.write(content)

for p in ['src/pages/about.astro', 'src/pages/contact.astro', 'src/pages/events.astro']:
    if os.path.exists(p):
        insert_import(p)
