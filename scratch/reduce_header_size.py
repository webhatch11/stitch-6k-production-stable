import os

APP_DIR = r"c:\7s inter folder\stitch_6k_production_ready_v2\app"

def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content
    
    # 1. Reduce header padding: py-4 -> py-2.5
    content = content.replace('mx-auto px-6 lg:px-20 py-4', 'mx-auto px-6 lg:px-20 py-2.5')
    content = content.replace('max-w-7xl mx-auto py-4', 'max-w-7xl mx-auto py-2.5')
    content = content.replace('lg:px-20 py-4', 'lg:px-20 py-2.5')
    
    # 2. Reduce circular logo size: w-14 h-14 -> w-11 h-11, p-2.5 -> p-1.5
    content = content.replace('w-14 h-14 rounded-full bg-white p-2.5', 'w-11 h-11 rounded-full bg-white p-1.5')
    
    if content != original_content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Reduced header size in: {file_path}")
        return True
        
    return False

def main():
    for root, dirs, files in os.walk(APP_DIR):
        for file in files:
            if file.endswith(".tsx"):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
