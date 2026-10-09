import os
import zipfile
import shutil

BASE_DIR = r"C:\Users\Lenovo\.gemini\antigravity\scratch\guardianband"
DOWNLOADS_DIR = os.path.join(os.environ.get("USERPROFILE", r"C:\Users\Lenovo"), "Downloads")
DESKTOP_DIR = os.path.join(os.environ.get("USERPROFILE", r"C:\Users\Lenovo"), "Desktop")

IGNORE_PATTERNS = {
    'node_modules', '.git', 'dist', '.vite', '.DS_Store', 'Thumbs.db', '__pycache__'
}

def should_ignore(path):
    parts = path.replace('/', '\\').split('\\')
    for p in parts:
        if p in IGNORE_PATTERNS:
            return True
    return False

def zip_directory(source_dir, output_zip_path, sub_folder_in_zip=""):
    print(f"Creating {os.path.basename(output_zip_path)} from {source_dir}...")
    with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            dirs[:] = [d for d in dirs if not should_ignore(d)]
            for file in files:
                if file.endswith('.zip') or file in IGNORE_PATTERNS:
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, source_dir)
                if should_ignore(rel_path):
                    continue
                arcname = os.path.join(sub_folder_in_zip, rel_path) if sub_folder_in_zip else rel_path
                zipf.write(file_path, arcname)

def main():
    packages = [
        ("websites/police-control-room", "1_Police_Control_Room.zip", "Police_Control_Room"),
        ("websites/central-dashboard", "2_Central_Dashboard.zip", "Central_Operations_Dashboard"),
        ("websites/guardian-portal", "3_Guardian_Portal.zip", "Guardian_Safety_Portal"),
        ("websites/device-simulator", "4_Device_Simulator.zip", "Device_Simulator"),
        ("backend", "5_Backend_Server.zip", "Backend_Server"),
    ]

    created_zips = []
    for rel_src, zip_name, inner_folder in packages:
        src = os.path.join(BASE_DIR, rel_src)
        out_zip = os.path.join(BASE_DIR, zip_name)
        zip_directory(src, out_zip, inner_folder)
        created_zips.append(out_zip)

    # Master all-in-one zip
    master_zip = os.path.join(BASE_DIR, "GuardianBand_Complete_All_In_One.zip")
    print(f"Creating Master all-in-one package: {master_zip}...")
    with zipfile.ZipFile(master_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(BASE_DIR):
            dirs[:] = [d for d in dirs if not should_ignore(d)]
            for file in files:
                if file.endswith('.zip') or file in IGNORE_PATTERNS or file == "package_zips.py":
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, BASE_DIR)
                if should_ignore(rel_path):
                    continue
                zipf.write(file_path, os.path.join("GuardianBand_Ecosystem", rel_path))
    created_zips.append(master_zip)

    # Copy to Downloads and Desktop
    for z in created_zips:
        base_name = os.path.basename(z)
        if os.path.exists(DOWNLOADS_DIR):
            shutil.copy2(z, os.path.join(DOWNLOADS_DIR, base_name))
        if os.path.exists(DESKTOP_DIR):
            shutil.copy2(z, os.path.join(DESKTOP_DIR, base_name))

    print("All packages successfully created and copied to Downloads and Desktop!")

if __name__ == "__main__":
    main()
