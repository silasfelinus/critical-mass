K8 Wildlife generated art delivery

All eleven animal paintings (levels 0–10) are present in this repository,
including the updated, fuller-figured dragon in three compositions.

Desktop artwork: admin/public/k8-animals/00-anemone.webp ... 10-dragon.webp
Tablet artwork:  admin/public/k8-animals/tablet/00-anemone.webp ... 10-dragon.webp
Mobile artwork:  admin/public/k8-animals/mobile/00-anemone.webp ... 10-dragon.webp

The app serves these paths under /k8-animals/ from the Vite public directory.
Each level has three WebP files; see assets-manifest.json for the filenames,
byte sizes, pixel dimensions, and SHA-256 checksums. npm test verifies the
manifest against the actual bytes.

Levels 0–9 use deliberate responsive crops from their original artwork;
the Level 10 dragon has separate desktop, tablet, and mobile illustrations.
Reference photographs were used to create the art and are not included
in the public repository.

Art files present on GitHub does not mean the separate K8 invited-account
portal is deployed. That feature is tracked independently in PR #2.
