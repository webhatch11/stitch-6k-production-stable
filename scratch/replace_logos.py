import os
import re

APP_DIR = r"c:\7s inter folder\stitch_6k_production_ready_v2\app"

# Matches a single <Link ...> containing M13.8261 without crossing other Link tags
LINK_PATTERN = re.compile(
    r'(<Link\s+[^>]*?href="/"[^>]*?>)((?:(?!</Link>)[\s\S])*?M13\.8261(?:(?!</Link>)[\s\S])*?)</Link>',
    re.IGNORECASE
)

# Matches a single <svg ...> containing M13.8261
SVG_PATTERN = re.compile(
    r'<svg[\s\S]*?M13\.8261[\s\S]*?</svg>',
    re.IGNORECASE
)

def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content
    
    # 1. Update <Link href="/"> elements that wrap the old SVG logo
    def link_replacer(match):
        open_tag = match.group(1)
        
        # Check if hover-scale is present in the original classes
        clean_classes = "flex items-center group"
        if "hover-scale" in open_tag:
            clean_classes += " hover-scale"
            
        return f'''<Link href="/" className="{clean_classes}">
              <img 
                src="/assets/logo.png" 
                alt="6K Logo" 
                className="h-10 w-auto object-contain" 
                draggable={{false}}
              />
            </Link>'''

    content = LINK_PATTERN.sub(link_replacer, content)

    # 2. Update remaining SVGs (like in the footer)
    def svg_replacer(match):
        return '''<img 
                    src="/assets/logo.png" 
                    alt="6K Logo" 
                    className="h-8 w-auto object-contain"
                    draggable={false}
                  />'''

    content = SVG_PATTERN.sub(svg_replacer, content)

    # 3. Clean up parent divs that wrapped the SVG in the footer (e.g. size-8 text-secondary)
    content = re.sub(
        r'<div\s+className="(?:size-8|w-8|h-8|w-6|h-6)\s+text-secondary">\s*(<img[^>]*?>)\s*</div>',
        r'\1',
        content,
        flags=re.IGNORECASE
    )
    content = re.sub(
        r'<div\s+className="text-secondary\s+(?:size-8|w-8|h-8|w-6|h-6)">\s*(<img[^>]*?>)\s*</div>',
        r'\1',
        content,
        flags=re.IGNORECASE
    )

    if content != original_content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated logo in: {file_path}")
        return True
        
    return False

def main():
    for root, dirs, files in os.walk(APP_DIR):
        for file in files:
            if file.endswith(".tsx"):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
