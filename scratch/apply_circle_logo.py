import os
import re

APP_DIR = r"c:\7s inter folder\stitch_6k_production_ready_v2\app"

# Match header image logo inside Link tag
HEADER_LOGO_PATTERN = re.compile(
    r'<Link\s+href="/"\s+className="([^"]*?)">\s*<img\s+src="/assets/logo\.png"\s+alt="6K Logo"\s+className="h-16 w-auto object-contain"\s+draggable=\{false\}\s*/>\s*</Link>',
    re.IGNORECASE
)

def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content
    
    def replacer(match):
        classes = match.group(1)
        return f'''<Link href="/" className="{classes}">
              <div className="w-14 h-14 rounded-full bg-white p-2.5 flex items-center justify-center shadow-md border border-[#775a19]/15">
                <img 
                  src="/assets/logo.png" 
                  alt="6K Logo" 
                  className="max-w-full max-h-full object-contain" 
                  draggable={{false}}
                />
              </div>
            </Link>'''

    content = HEADER_LOGO_PATTERN.sub(replacer, content)

    if content != original_content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated header logo to circle in: {file_path}")
        return True
        
    return False

def main():
    for root, dirs, files in os.walk(APP_DIR):
        for file in files:
            if file.endswith(".tsx"):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
