# K8 Wildlife Portfolio: eleven original animal plates

## Purpose

K8's cinematic risk dial lives at `/:exchange/:pair/k8` in the authenticated
Critical Mass admin. It is a loving private joke for K8, not an advert or
performance claim. The selection controls genuine per-fund aggressiveness.
The current implementation expects one immersive landscape illustration per
numeric level in `admin/public/k8-animals/`. No images have been delivered
yet. The in-app emoji/gradient treatment is an explicit temporary fallback.

**Art is not complete until all eleven files exist and the phone + desktop
layout has been visually reviewed.** Do not mark emoji fallback as delivered
art. Keep images outside Git history when handing them to an ArtJob/CDN; if
hosted externally, update the path resolver and asset manifest together.

## Shared visual identity

K8 is not a supplied likeness. Until a reference photograph is supplied,
paint an *original anthropomorphic animal avatar* with a consistent signature:
a dramatic gravity-defying rainbow hairdo, gold star earrings or analogues
where anatomy permits, a tiny K8 monogram, irreverent warmth, confident
personality, and high-end hand-painted Saturday-morning cartoon finish.
No borrowed cartoon characters, investor celebrities, exchange logos or
identifiable human face. Never claim the animal paintings reproduce K8's
actual appearance without K8's own visual reference and approval.

Frame: 16:9 or wider at 2560x1440 minimum, art carried by the left or right
half as directed below. A large dark, low-detail negative-space region on
the **opposite side** is crucial: the live controls and typography overlay
there. Keep the animal's eyes/face and meaningful props unobscured at
mobile crop (central 9:16). No baked text, prices, UI, numbers, stock charts,
financial-performance promises, or logos.

| Level | File | Animal + composition | Art direction |
| --- | --- | --- | --- |
| 0 | `00-anemone.webp` | Anemone on right | K8 sea anemone reclines in a neon coral penthouse, pearls and rainbow tendrils, unbothered by the apocalypse |
| 1 | `01-snail.webp` | Snail on left | K8 snail with an ornate jeweled spiral shell, silk scarf and a ridiculously tiny briefcase, waiting patiently for the moon |
| 2 | `02-sloth.webp` | Sloth on right | K8 sloth lounges upside-down in a velvet casino chandelier, rainbow coiffure miraculously perfect |
| 3 | `03-tortoise.webp` | Tortoise on left | K8 tortoise struts across a sun-drenched art-deco boulevard, a little crown suspended over the shell |
| 4 | `04-capybara.webp` | Capybara on right | K8 capybara soaks in an extravagant marble bath, cucumber slices and self-confident rainbow pompadour |
| 5 | `05-otter.webp` | Otter on left | K8 otter pirouettes on a moonlit river, balancing a polished gemstone and an opera glass |
| 6 | `06-fox.webp` | Fox on right | K8 fox in a sumptuous emerald velvet suit, portrait of a detective who knows the ending but won't tell |
| 7 | `07-cheetah.webp` | Cheetah on left | K8 cheetah in a retro-futuristic racer jumps through a molten neon horizon, grin fully visible |
| 8 | `08-honey-badger.webp` | Honey badger on right | K8 honey badger in glittering rebel armor, dramatic thunder, gold earrings catching the light |
| 9 | `09-phoenix.webp` | Phoenix on left | K8 phoenix erupts from magenta and citrus flames, rainbow-feather crest, theatrical and triumphant, no money imagery |
| 10 | `10-dragon.webp` | Dragon on right | K8 dragon fills a volcanic palace with iridescent rainbow scales, lounging on a mountain of comically impractical fancy buttons |

## UI and investment boundaries

- The page is reachable only behind the existing operator login and per-fund URL.
- Previewing a number never mutates anything.
- Each integer 1 through 10 interpolates **actual** parameters between the
  gateway's four configured aggressiveness presets. Because custom presets
  can be misordered, the page blocks writes until the ladder is valid.
- Zero explicitly stops the engine; it does **not** liquidate holdings or
  guarantee existing exchange orders are cancelled.
- `maxUsdcDeployed`, `maxDrawdownPercent`, deposits, execution mode, and
  exchange selection are unchanged.
- K8 must explicitly confirm changes; if a running engine fails to acknowledge
  a persisted setting, the UI reports saved-but-not-applied.
- The contribution plan is **not** an existing software cap or subscription
  created by this page. Confirm the real exchange capital cap and contribution
  schedule separately before ever running with live funds.
- Risk is an ordering of trading aggressiveness, not a measured 0–10
  probability of loss. A highly cautious setting can still lose 100%
  of allocated capital.

## Delivery checklist

1. Render eleven distinct originals through the approved art pipeline, with
   generation IDs and source prompts recorded. No public promotion required.
2. If K8 supplies a portrait, use only with her approval, and keep it out of
   a public prompt or Git blob.
3. Save each plate with the exact filename above and place or serve under the
   configured asset path.
4. Test 390px, 768px, 1440px, wide desktop and short mobile landscape. Ensure
   the overlay never blocks the animal's face.
5. Verify the current applied level against the gateway and confirm on a
   dry-run fund before turning on live trading. Any live-money change requires
   explicit authorization from the account operator.
