# Quick Start - AE MCP Server

## 60-Second Setup

1. **Install deps:**
   ```bash
   npm install
   ```

2. **Start server:**
   ```bash
   npm run mcp:server
   ```
   Server runs on `localhost:3000`

3. **Open After Effects** + go to **Window → Extensions → AE MCP Bridge**

4. **Connect panel:**
   - URL: `localhost:3000`
   - Click **Connect**
   - Status turns green

5. **Use CLI (terminal):**
   ```
   You: Create composition MyComp 1920x1080 10 seconds 24fps
   ```
   Watch it execute in AE!

## CLI Commands (Examples)

```
# Create composition
"Create a 1920x1080 composition called MyComp duration 10 seconds at 24fps"

# Add layers
"Add a solid layer called Background to MyComp"
"Add text layer called Title to MyComp"

# Modify properties
"Set opacity of Title to 50%"
"Move Background to position 960, 540"
"Scale Background to 80%"
"Rotate Title by 45 degrees"

# Advanced
"Make Title bounce up and down with an expression"
"Add a glow effect to Title"
"Create a fade animation from 100% to 0% opacity in 3 seconds"
"Create a control null for Title"
"Export MyComp to /output/video.mp4"
```

## Files Created

| File | Purpose |
|------|---------|
| `src/mcp/server.ts` | MCP server + CLI |
| `CSXS/mcp-panel.html` | CEP panel UI |
| `CSXS/mcp-panel.js` | CEP polling + execution |
| `CSXS/manifest-mcp.xml` | CEP extension config |
| `jsx/ae-bridge.jsx` | ExtendScript handlers |

## Architecture

```
Your Request (CLI)
       ↓
   MCP Server
       ↓
   HTTP Request
       ↓
   CEP Panel (in AE)
       ↓
   ExtendScript → After Effects
```

## What Works Now

✅ Create compositions (name, size, duration, fps)  
✅ Add layers (solid, text, null)  
✅ Modify properties (position, opacity, scale, rotation)  
✅ Get composition info  
✅ Apply expressions (bounce, link, math)  
✅ Add effects (blur, glow, color correction)  
✅ Set keyframes (animation)  
✅ Create null controllers  
✅ Queue for export  
✅ Custom scripting (safe)  

## What's Next

- Bézier path animation
- 3D transform support
- Effect parameter control
- Undo/redo history
- Batch operations
- More export templates

## Troubleshooting

**Panel won't connect?**
- Check server: `npm run mcp:server` still running?
- Firewall block localhost:3000?
- Try different port: `PORT=5000 npm run mcp:server`

**Commands timeout?**
- AE busy with render?
- Layer/comp names must match exactly
- Check AE console for ExtendScript errors

**Need to restart?**
- Stop server: `Ctrl+C`
- Close After Effects
- Run: `npm run mcp:server` again

## API Reference

### Tool Call Flow

```
Claude Request
  → Tool Call (e.g., create_composition)
  → Server queues command (pending)
  → CEP panel polls /api/commands/pending
  → Executes ExtendScript
  → Reports result
  → Server returns to Claude
```

**Timeout:** 30 seconds

### Endpoints

- **GET** `/api/commands/pending` - List pending commands
- **POST** `/api/commands/{id}/result` - Report execution result

## Model Selection

Default: **claude-opus-4-7** (most capable)

Change in `server.ts` line ~94:
```typescript
model: "claude-sonnet-4-6"  // faster, cheaper
```

## Environment

Add to `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
```

## Next Command

```bash
npm install
npm run mcp:server
```

Then open another terminal in AE and try:
```
You: Create a 1920x1080 composition
```

Good luck!
