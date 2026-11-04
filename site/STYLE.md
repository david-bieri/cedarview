# Cedarview House — voice, look and photo order

Everything factual lives in `data/site.json`. This file holds the judgement calls so anyone (or any agent) editing the site makes the same ones.

## The house, in one line
A natural white brick and cedar contemporary (1983) in Forest Hills, Blacksburg, on a wooded acre at the end of a cul-de-sac, facing south toward Ellett.

The exterior is painted brick with cedar siding on the upper storey; the cedar is also inside (family-room wall and ceiling, porch ceiling, open oak stair). The words that may never appear on the site are listed in `wordingRules.banned` in `data/site.json`; do not repeat them here or anywhere else in the repo.

## Voice
- Describe the house and the place, never the buyer. Rooms, levels, materials, light, distances.
- Plain, specific, measured. "1,491 finished sq ft on the lower level" beats a vague superlative.
- Claims must be documented: permits, dates, measured plans, the deed. If it isn't in `site.json`, it isn't on the site.
- Virtual staging is always labelled, on the image and beside it, and the unstaged photo is always one tap away.

## Look (measured from the photographs, see `design.palette`)
| Token | Hex | Source | Use |
|---|---|---|---|
| cream | `#EFE9DC` | painted brick, interior walls | page ground |
| creamDeep | `#E3DBC9` | brick in shade | panels |
| ink | `#1D2430` | window frames, twilight | text |
| cobalt | `#2B4C8C` | the front door | the one accent: buttons, badges, eyebrow pill |
| rust | `#8C4A2E` | composite deck | section numbers only |
| oak | `#B8864C` | stair, floors, cedar | hairline rules, small labels on dark |
| ridge | `#2E3A4F` | mountains at dusk | At-a-glance and View bands |
| rule | `#CFC6B4` | — | hairlines on cream |

No greens: the house has none, and they fight the autumn photos.

Type: Fraunces 300/400 for display, Inter for everything else. Structure: direction B's full-bleed hero and square-tile gallery, then direction C's numbered, ruled sections (01 The house … 08 Visit).

## Photo order (from `assets/src/photos.json`, 46 of the photographer's 121)
1. Hero: twilight exterior (#0), then the daylight front elevation (#1, `exterior-front`) full width directly beneath it — the twilight shot sells the mood, the daylight shot explains the house. #1 therefore does not repeat in the grounds gallery.
2. The house gallery, lead tile 2×2: living room with the oak stair (#48), then family room (#52), fireplace (#55), kitchen (#72), front door (#31), stair (#49), screened porch (#79), primary bath (#61), dining (#56), library (#50), kitchen island (#73), breakfast room (#76), upper landing (#84), primary bedroom (#86).
3. The grounds: approach (#22), rear with fire pit (#39), path (#35), woods (#34), lot aerials (#5, #6).
4. Lower level: bedroom 1 (#101) lead, bedroom 2 (#103), rec room (#108), bath (#111), workshop (#112), gym (#115).
5. Plans: #117–120.
6. The view: ridge wide (#11) lead, #12, #13, #10.

Staged views: eleven of Brian's frames, virtually staged by Nancy (`images.stagedRooms`). For each, the unstaged file is Brian's original cropped to exactly the staged field of view (the staging tool recrops, sometimes outpaints a few per cent and once rotated 1°), so the toggle changes furniture and nothing else. Never label an unstaged image, and never use a staged frame without its same-angle original: match by SIFT/affine, not by eye.

## Bedrooms and baths (confirmed)
- Main floor: 1 bedroom (primary), 1 full bath with shower and jacuzzi, 1 half bath. Upper floor: 3 bedrooms, 1 full, 1 three-quarter. Lower level: 4 bedrooms (all with egress windows), 1 full bath. Building codes do not require a closet for a bedroom; egress, ceiling height and floor area do.
- The photographer's lower-level plan labelled one of the four bedrooms "Exercise Room" (its current use); the plan image in `assets/src/plan-lower-level.jpg` has been relabelled Bedroom and tinted to match the other three, so the plan and the listing agree. If Brian re-issues the plans, ask for the same label.

## Still to get from the photographer
- One photo from the deck or upper floor that shows the ridge (the claim buyers check first). None in the set.
- Re-shoot or drop: garage with bins and bikes (#81, #82), balcony with chairs, gym with the weight bench (#115, #116).
- Nothing outstanding on staging. Brian's full set (117 files, `cedarview_photos`) is on David's laptop; the curated names map to his numbers via the 1.00 correlation check in the session notes (e.g. living-room = #93, dining = #104, family-room = #101).

## Placeholders
A `TBC` value is never shown. The build leaves the line, row or section out and says so; `npm run check` fails if one leaks. Write nothing on the page that reads as a note to ourselves ("not yet added", "to be confirmed", "see site.json"): if the fact is not confirmed, the page says nothing, and the spec sheet prints "on request".

## Launch day
`site.noindex` → false, `site.listingLive` → true, `property.status` → "For sale", `robots.txt` Disallow → Allow, `npm run build` (the check now insists on the agent's contact details), commit, push. Same day as the MLS.
