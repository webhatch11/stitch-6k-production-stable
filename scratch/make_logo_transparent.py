import os
from PIL import Image

LOGO_PATH = r"c:\7s inter folder\stitch_6k_production_ready_v2\public\assets\logo.png"

def make_transparent(image_path, threshold=20):
    if not os.path.exists(image_path):
        print(f"Error: {image_path} does not exist.")
        return

    # Open image and convert to RGBA
    img = Image.open(image_path).convert("RGBA")
    datas = img.getdata()

    # The background color is at the top-left corner pixel (0, 0)
    bg_color = datas[0]
    bg_r, bg_g, bg_b, _ = bg_color
    print(f"Detected background color: RGB({bg_r}, {bg_g}, {bg_b})")

    new_data = []
    for item in datas:
        r, g, b, a = item
        # Calculate color distance in RGB space
        distance = ((r - bg_r) ** 2 + (g - bg_g) ** 2 + (b - bg_b) ** 2) ** 0.5
        
        # If the pixel color is very close to the background color, make it transparent
        if distance < threshold:
            new_data.append((0, 0, 0, 0))  # Transparent pixel
        else:
            new_data.append((r, g, b, a))  # Keep original pixel

    img.putdata(new_data)
    img.save(image_path, "PNG")
    print(f"Successfully processed image and saved to {image_path}")

if __name__ == "__main__":
    make_transparent(LOGO_PATH)
