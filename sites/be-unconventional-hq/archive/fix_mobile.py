import re

file_path = 'src/styles/global.css'
with open(file_path, 'r') as f:
    content = f.read()

# Fix Hero Typography Alignment & Scaling
content = re.sub(
    r'\.hero \.word-be \{.*?margin-left: -15% !important;.*?\}',
    '.hero .word-be {\n    margin-left: -18% !important; /* Restore 'B' alignment above N/V region */\n    transform: none !important;\n    align-self: center;\n    font-size: 1rem !important;\n    margin-bottom: 0.5rem !important;\n  }',
    content, flags=re.DOTALL
)

content = re.sub(
    r'\.word-unconventional \{.*?font-size: clamp\(1.1rem, 7.5vw, 2.0rem\) !important;.*?\}',
    '.word-unconventional {\n    font-size: clamp(1.1rem, 7.5vw, 2.1rem) !important; /* Fits iPhone SE/Pro Max */\n    white-space: nowrap !important;\n    letter-spacing: -0.02em;\n    transform: none !important;\n    margin: 0 !important;\n  }',
    content, flags=re.DOTALL
)

content = re.sub(
    r'\.hero \.word-hq \{.*?margin-right: -20% !important;.*?\}',
    '.hero .word-hq {\n    margin-right: -25% !important; /* Restore tuck under N/T region */\n    margin-top: -0.6rem !important;\n    transform: none !important;\n    font-size: clamp(0.9rem, 5vw, 1.6rem) !important;\n    align-self: center;\n  }',
    content, flags=re.DOTALL
)

# Ensure Hero Title Stack is contained
content = re.sub(
    r'\.hero-title-stack \{.*?max-width: 100%;.*?\}',
    '.hero-title-stack {\n    max-width: 90vw;\n    padding: 0 1rem;\n    margin: 0 auto;\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    overflow: visible;\n  }',
    content, flags=re.DOTALL
)

# Fix horizontal overflow globally by ensuring no element pushes body
content = content.replace('max-width: 100vw;', 'max-width: 100%;')

with open(file_path, 'w') as f:
    f.write(content)
