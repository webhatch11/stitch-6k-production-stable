import os

APP_DIR = r"c:\7s inter folder\stitch_6k_production_ready_v2\app"

def process_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content
    
    # Replace h-10 w-auto object-contain with h-16 w-auto object-contain
    content = content.replace('className="h-10 w-auto object-contain"', 'className="h-16 w-auto object-contain"')
    
    if content != original_content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated header logo size in: {file_path}")
        return True
        
    return False

def main():
    for root, dirs, files in os.walk(APP_DIR):
        for file in files:
            if file.endswith(".tsx"):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
