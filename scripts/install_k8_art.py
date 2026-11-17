#!/usr/bin/env python3
"""Install the verified K8 Wildlife artwork pack into this repository.

The zip contains the commissioned/generated K8 animals at 0–9 and
tablet/mobile derivatives. Level 10 must be supplied separately before
the set can be considered complete. This command never accesses accounts,
the trading engine, financial state, or the original reference photos.
"""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "admin" / "public" / "k8-animals"
ANIMALS = ["anemone", "snail", "sloth", "tortoise", "capybara",
           "otter", "fox", "cheetah", "honey-badger", "phoenix"]
VARIANTS = {"desktop": ("", (1672, 941)), "tablet": ("tablet/", (1024, 768)),
            "mobile": ("mobile/", (720, 1280))}


def install(archive: Path, dry_run: bool = False):
    with ZipFile(archive) as packet:
        manifest = json.loads(packet.read("assets-manifest.json"))
        if manifest.get("missing_levels") != [10]:
            raise ValueError("unexpected pack version: level 10 is still missing")
        expected = {}
        for i, animal in enumerate(ANIMALS):
            filename = f"{i:02}-{animal}.webp"
            for variant, (folder, dimensions) in VARIANTS.items():
                expected[folder + filename] = dimensions
        if set(expected) - set(packet.namelist()):
            raise ValueError("art pack is incomplete")
        verified = []
        for name, dimensions in expected.items():
            raw = packet.read(name)
            if len(raw) < 16 or raw[:4] != b"RIFF" or raw[8:12] != b"WEBP":
                raise ValueError(f"invalid WebP header: {name}")
            entry = next((a for a in manifest["assets"] if
                          name in (a["desktop"]["file"], a["tablet"]["file"], a["mobile"]["file"])), None)
            if entry is None:
                raise ValueError(f"missing checksum entry for {name}")
            variant_key = "mobile" if name.startswith("mobile/") else "tablet" if name.startswith("tablet/") else "desktop"
            if entry[variant_key]["size"] != list(dimensions):
                raise ValueError(f"wrong declared dimensions: {name}")
            if hashlib.sha256(raw).hexdigest() != entry[variant_key]["sha256"]:
                raise ValueError(f"hash mismatch: {name}")
            verified.append((name, raw))
        if dry_run:
            print(f"Validated {len(verified)} artwork files. No changes written.")
            return
        for name, raw in verified:
            target = DESTINATION / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
        print(f"Installed {len(verified)} K8 assets into {DESTINATION}.")
        print("Level 10 Dragon is missing. Do not mark full gallery complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    install(args.archive, args.dry_run)
