# Print files

Files for the printer and the sign vendor. Not published on the site.

- `qr-yard-sign.svg` — vector QR for the yard-sign rider; send this one to the sign vendor.
- `qr-yard-sign.png` — the same code as a 1640 px PNG (about 5.5 in at 300 dpi).

Both encode `https://cedarview.house/qr`, which forwards to the home page tagged `utm_source=yard-sign&utm_medium=qr`. The rider's printed URL should read `cedarview.house/sign`; the neighbourhood postcard `cedarview.house/go`; the referral postcard `cedarview.house/card`. Each of these is a channel with a `short` field in `site/data/site.json`; the build writes the forwarding pages and lists them in `site/scripts/tracked-links.md`.

Keep the quiet zone (the white border) when placing the code, print it at least 2 cm (0.8 in) square on a card and larger on a sign meant to be read from the street, and test-scan the proof with two phones before approving it.
