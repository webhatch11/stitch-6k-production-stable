import os

APP_DIR = r"c:\7s inter folder\stitch_6k_production_ready_v2\app"

def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    
    # 1. Replace preloader tagline specifically in page.tsx
    if "page.tsx" in file_path.lower():
        # Tagline replacement
        content = content.replace("Predefining Luxury", "Designer Shirts")
        # Preloader main header text
        content = content.replace('className="shimmer-text">6K Shirts</span>', 'className="shimmer-text">6K Designer Shirts</span>')
    
    # 2. Replace brand footer/copyright texts
    content = content.replace("6K Shirts</span>", "6K Designer Shirts</span>")
    content = content.replace("6K Shirts Management", "6K Designer Shirts Management")
    content = content.replace("6K Shirts.", "6K Designer Shirts.")
    content = content.replace("6K Shirts", "6K Designer Shirts")

    if content != original:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated brand text in: {file_path}")
        return True
    return False

def main():
    for root, dirs, files in os.walk(APP_DIR):
        for file in files:
            if file.endswith(".tsx"):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
