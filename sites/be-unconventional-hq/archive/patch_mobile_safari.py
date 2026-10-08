import re

with open('src/styles/global.css', 'r') as f:
    css = f.read()

# Look for the hero class
hero_match = re.search(r'\.hero\s*\{[^}]*\}', css)
if hero_match:
    hero_css = hero_match.group(0)
    print("Found hero CSS:")
    print(hero_css)

