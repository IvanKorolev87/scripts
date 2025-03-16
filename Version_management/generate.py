import json
import sys
import os
import argparse
from datetime import datetime
import xml.etree.ElementTree as ET

def parse_arguments():
    """Parse command line arguments"""
    # Create an epilog with usage examples
    epilog = """
Examples:
  # Append a new iOS beta version:
  python generate.py append --platform ios --type beta --version 1.3.0 --link "https://example.com/download/app-1.3.0.ipa" --changelog "New feature: Dark mode" "Bug fixes"

  # Append a new Android release version:
  python generate.py append --platform android --type release --version 1.2.1 --link "https://example.com/download/app-1.2.1.apk" --changelog "Performance improvements" "Battery usage optimizations"

  # Promote a beta version to release:
  python generate.py promote --platform ios --version 1.3.0
"""

    parser = argparse.ArgumentParser(
        description='Manage app versions and appcast',
        epilog=epilog,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    subparsers = parser.add_subparsers(dest='action', help='Action to perform')

    # Append version command with examples
    append_parser = subparsers.add_parser('append',
        help='Append a new version',
        description='Add a new version to the versions file and update the appcast',
        epilog="""
Examples:
  # Add iOS beta with changelog:
  python generate.py append --platform ios --type beta --version 1.3.0 --link "https://example.com/download/app-1.3.0.ipa" --changelog "New feature: Dark mode" "Bug fixes"

  # Add Android release:
  python generate.py append --platform android --type release --version 1.2.1 --link "https://example.com/download/app-1.2.1.apk" --changelog "Performance improvements"
""",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    append_parser.add_argument('--platform', required=True, help='Platform (ios, android)')
    append_parser.add_argument('--type', required=True, help='Version type (beta, release)')
    append_parser.add_argument('--version', required=True, help='Version number')
    append_parser.add_argument('--link', required=True, help='Download link')
    append_parser.add_argument('--changelog', nargs='*', default=[], help='Changelog entries (multiple entries allowed)')

    # Promote version command with examples
    promote_parser = subparsers.add_parser('promote',
        help='Promote a beta version to release',
        description='Copy a beta version to the release section',
        epilog="""
Examples:
  # Promote iOS beta:
  python generate.py promote --platform ios --version 1.3.0

  # Promote Android beta:
  python generate.py promote --platform android --version 1.3.0
""",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    promote_parser.add_argument('--platform', required=True, help='Platform (ios, android)')
    promote_parser.add_argument('--version', required=True, help='Version number to promote')

    # If no arguments are provided, print help and exit
    if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(0)

    return parser.parse_args()

def load_versions(versions_path):
    """Load versions from JSON file"""
    try:
        with open(versions_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        # Create default structure if file doesn't exist
        return {
            "ios": {"beta": [], "release": []},
            "android": {"beta": [], "release": []}
        }

def save_versions(versions, versions_path):
    """Save versions to JSON file"""
    with open(versions_path, 'w') as f:
        json.dump(versions, f, indent=2)

def append_version(versions, platform, type, version, link, changelog):
    """Append a new version to versions data"""
    new_entry = {
        "versionNumber": version,
        "releaseDate": datetime.now().strftime("%Y-%m-%d"),
        "downloadLink": link,
        "changelog": changelog
    }

    # Ensure platform and type exist in structure
    if platform not in versions:
        versions[platform] = {"beta": [], "release": []}
    if type not in versions[platform]:
        versions[platform][type] = []

    versions[platform][type].insert(0, new_entry)
    return versions

def promote_version(versions, platform, version_number):
    """Promote a beta version to release"""
    if platform not in versions or "beta" not in versions[platform] or "release" not in versions[platform]:
        raise ValueError(f"Invalid platform '{platform}' or missing beta/release types")

    # Find the beta version to promote
    beta_entry = None
    for entry in versions[platform]["beta"]:
        if entry["versionNumber"] == version_number:
            beta_entry = entry
            break

    if not beta_entry:
        raise ValueError(f"Beta version {version_number} not found for platform {platform}")

    # Add version to releases (at the beginning)
    versions[platform]["release"].insert(0, beta_entry.copy())

    return versions

def update_appcast(versions, appcast_path):
    """Generate and update the appcast XML file"""
    root = ET.Element('appcast')

    for plat, types in versions.items():
        if not any(entries for entries in types.values()):
            continue  # Skip platform if it has no entries

        app = ET.SubElement(root, 'app', {'platform': plat})
        for typ, entries in types.items():
            if not entries:
                continue  # Skip type if it has no entries

            for entry in entries:
                ver = ET.SubElement(app, 'version', {'type': typ})
                ET.SubElement(ver, 'versionNumber').text = entry['versionNumber']
                ET.SubElement(ver, 'releaseDate').text = entry['releaseDate']
                ET.SubElement(ver, 'downloadLink').text = entry['downloadLink']

                # Add changelog section
                if 'changelog' in entry and entry['changelog']:
                    changelog_element = ET.SubElement(ver, 'changelog')
                    for change in entry['changelog']:
                        ET.SubElement(changelog_element, 'item').text = change

    # Use ET.indent only if it's available (Python 3.9+)
    try:
        ET.indent(root, space="  ")
    except AttributeError:
        # For older Python versions, we can skip indentation
        pass

    ET.ElementTree(root).write(appcast_path, encoding='utf-8', xml_declaration=True)

def main():
    """Main function to process command line arguments"""
    args = parse_arguments()

    # Get script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Path to versions.json relative to script
    versions_path = os.path.join(script_dir, 'versions.json')
    appcast_path = os.path.join(script_dir, 'appcast.xml')

    # Load existing versions
    versions = load_versions(versions_path)

    if args.action == 'append':
        # Append a new version
        versions = append_version(
            versions,
            args.platform,
            args.type,
            args.version,
            args.link,
            args.changelog
        )
        save_versions(versions, versions_path)
        update_appcast(versions, appcast_path)
        print(f"Version {args.version} appended to {args.platform}/{args.type}")

    elif args.action == 'promote':
        # Promote a beta version to release
        try:
            versions = promote_version(versions, args.platform, args.version)
            save_versions(versions, versions_path)
            update_appcast(versions, appcast_path)
            print(f"Version {args.version} promoted from beta to release for {args.platform}")
        except ValueError as e:
            print(f"Error: {e}")
            sys.exit(1)

    else:
        print("No valid action specified. Use 'append' or 'promote'.")
        sys.exit(1)

if __name__ == "__main__":
    main()