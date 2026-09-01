# BHOOMI-NETRA — Landing Page

Marketing site for BHOOMI-NETRA, a disaster early-warning network for floods and
forest fires: solar-powered field sensors, terrain-based spread simulation, and
instant citizen alerts.

Part of the [BHOOMI-NETRA](../) monorepo (SIH 2026).

## Development

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev
```

| Script | Purpose |
| --- | --- |
| `bun run dev` | Start the dev server |
| `bun run build` | Production build |
| `bun run preview` | Serve the production build locally |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |

## Deploying

`vite build` runs [Nitro](https://nitro.build), which auto-detects the
deployment preset from the host. Set `NITRO_PRESET` to target one explicitly:

```sh
NITRO_PRESET=cloudflare_module bun run build
```

## Stack

- TanStack Start (file-based routing in `src/routes` — see `src/routes/README.md`)
- React 19 + TypeScript
- Tailwind CSS v4 with shadcn/ui components in `src/components/ui`
