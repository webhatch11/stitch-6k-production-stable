import os
import re

APP_DIR = r"c:\7s inter folder\stitch_6k_production_ready_v2\app"

# Match any <svg ...> ... </svg> block containing the old path coordinate M13.8261
SVG_PATTERN = re.compile(r"<svg[\s\S]*?M13\.8261[\s\S]*?</svg>", re.IGNORECASE)

# Circular logo disk replacement (perfect for light background headers/summaries)
LOGO_REPLACEMENT_LIGHT = """<div className="w-8 h-8 rounded-full bg-[#faf9f8] p-1 flex items-center justify-center shadow-sm border border-[#775a19]/15">
                  <img 
                    src="/assets/logo.png" 
                    alt="6K Logo" 
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                  />
                </div>"""

# Circular logo disk replacement (perfect for dark background footers)
LOGO_REPLACEMENT_DARK = """<div className="w-8 h-8 rounded-full bg-white p-1 flex items-center justify-center shadow-md">
                  <img 
                    src="/assets/logo.png" 
                    alt="6K Logo" 
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                  />
                </div>"""

def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    matches = list(SVG_PATTERN.finditer(content))
    if not matches:
        return False

    new_content = ""
    last_idx = 0
    for match in matches:
        start, end = match.span()
        # Peek at the surrounding context to see if it is inside the footer
        # The footer typically contains "Global Footer" or background color #0A0A0A or bg-black or similar nearby
        surround_start = max(0, start - 1500)
        surround_end = min(len(content), end + 1500)
        surround_text = content[surround_start:surround_end].lower()
        
        is_footer = "footer" in surround_text or "bg-[#0a0a0a]" in surround_text
        replacement = LOGO_REPLACEMENT_DARK if is_footer else LOGO_REPLACEMENT_LIGHT
        
        new_content += content[last_idx:start] + replacement
        last_idx = end
    
    new_content += content[last_idx:]

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    
    print(f"Updated logo in: {file_path}")
    return True

def main():
    for root, dirs, files in os.walk(APP_DIR):
        for file in files:
            if file.endswith(".tsx"):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
