# Slot Machine Game Engine

A modern, extensible slot machine game engine built with vanilla JavaScript and Canvas. Designed to support rich game mechanics similar to Hacksaw Gaming while maintaining a clean, secure architecture suitable for production casino platforms.

## Overview

This project is a **demo slot machine** that demonstrates:
- Secure RNG patterns (server-side ready)
- Multiple slot game types
- Modern bonus mechanics
- Rich animation effects
- Extensible architecture for adding new game variants

## Key Features

✨ **Modern Architecture**
- State machine game flow
- Outcome-before-animation pattern (like real casinos)
- Pluggable game modules
- API-ready backend abstraction

🎮 **Flexible Game Mechanics**
- 3-reel, 5-reel, and Megaways support
- Free spins, bonus rounds, multipliers
- Scatter/Wild symbols
- Hold & Re-spin features
- Collection mechanics

🔒 **Security-First Design**
- Server-side RNG (simulated in demo, ready for production)
- Deterministic reel animations
- Outcome validation architecture
- Transaction logging ready

🎨 **Extensible Rendering**
- Canvas-based graphics (Pixi.js)
- Smooth animations (GSAP)
- Support for both 2D and 3D effects
- Easy to integrate custom art

## Project Structure

```
slot/
├── ARCHITECTURE.md          # System design & patterns
├── DECISIONS.md             # Technical decision log
├── src/
│   ├── core/               # Game engine core
│   │   ├── gameEngine.js
│   │   ├── rng.js
│   │   ├── payoutCalculator.js
│   │   └── stateMachine.js
│   ├── renderer/           # Rendering system
│   ├── games/              # Game implementations
│   ├── ui/                 # UI components
│   ├── api/                # Backend API client
│   └── index.js
├── public/                 # Static assets
├── tests/                  # Test suite
├── package.json
├── vite.config.js
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 16+ (for development)
- Modern browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone repo (or in this case, already have folder)
cd slot

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:5173
```

### Build for Production

```bash
npm run build
npm run preview
```

## Architecture Highlights

### 1. Security Model (Server-Side RNG Ready)

```javascript
// Backend generates outcome
const outcome = {
    reelStops: [2, 5, 1],        // Which symbols show
    winAmount: 100,               // Payout amount
    features: [],                 // Trigger bonuses?
    timestamp: Date.now()
};

// Frontend animates only what backend determined
// Frontend CANNOT change the outcome
```

### 2. Game State Flow

```
IDLE
  ↓
AWAITING_RESULT (request spin outcome)
  ↓
SPINNING (animate reels to predetermined stops)
  ↓
RESULT_DISPLAY (show win/loss)
  ↓
IDLE (can spin again)
```

### 3. Pluggable Game Types

```javascript
// Base class that all slot games extend
class SlotGame {
    constructor(config) {
        this.symbols = config.symbols;
        this.paylines = config.paylines;
        this.rtp = config.rtp;
        // ...
    }
    
    spin() { /* override */ }
    detectWins(reelStops) { /* override */ }
    getBonus() { /* override */ }
}

// Add new game type:
class MyAwesomeSlot extends SlotGame {
    // Custom logic here
}
```

## Development Guide

### Adding a New Slot Game

1. **Create game config**
   ```javascript
   // src/games/mySlot/config.js
   export const MySlotConfig = {
       name: "My Awesome Slot",
       reels: 5,
       symbols: ['A', 'K', 'Q', 'J', '10', 'Wild', 'Scatter'],
       paylines: 25,
       rtp: 0.96,  // 96% return to player
       // ...
   };
   ```

2. **Implement game logic**
   ```javascript
   // src/games/mySlot/logic.js
   export class MySlot extends SlotGame {
       detectWins(reelStops) {
           // Your win detection logic
       }
   }
   ```

3. **Create renderer**
   ```javascript
   // src/games/mySlot/renderer.js
   export class MySlotRenderer {
       render(canvas, reelStops) {
           // Your rendering logic
       }
   }
   ```

### Testing

The project uses Jest with ES modules support for modern JavaScript testing.

```bash
# Run all tests
npm test

# Run all tests (if npm test doesn't work or for ES modules explicitly)
node --experimental-vm-modules node_modules/jest/bin/jest.js

# Run specific test file
npm test cascadeDetector.test.js

# Run tests in watch mode (reruns on file changes)
npm test -- --watch

# Run tests with coverage report
npm test -- --coverage
```

#### Current Test Suites
- **cascadeDetector.test.js** - Tests for cluster detection algorithm (49 tests)
  - Basic horizontal/vertical/L-shaped cluster detection
  - Cluster size payout scaling
  - Wild symbol substitution
  - Multiple simultaneous clusters
  
- **cascadeEngine.test.js** - Tests for cascade physics and gravity
  - Symbol gravity/falling mechanics
  - New symbol generation
  - Full cascade execution
  - Movement tracking for animations

#### RNG Testing

The RNG is seeded and deterministic for testing:

```javascript
import { RNG } from './src/core/rng.js';

// Reproducible results
const rng = new RNG('seed123');
const spin1 = rng.generate(3, 22);  // Same result every time with same seed
```

## Design Philosophy

### Why This Architecture?

1. **Real Casino Pattern**: Outcomes determined before animation (not during)
2. **Extensible**: Easy to add new slot types without touching core engine
3. **Testable**: Each component (RNG, payout calc, animation) can be tested independently
4. **Production-Ready**: Designed to evolve into real casino platform
5. **Modern Mechanics**: Supports complex features like Hacksaw Gaming's bonus systems

### Comparison: Our Approach vs Alternatives

| Aspect | Our Approach | Naive Approach |
|--------|-------------|-----------------|
| RNG Timing | Before animation | During animation ❌ Hackable |
| Game Addition | Pluggable modules | Modify core engine ❌ Fragile |
| Backend Ready | API abstraction | Embedded logic ❌ Hard to migrate |
| Testing | Unit + integration | Manual only ❌ Unreliable |
| Extensibility | Config-based | Code changes ❌ Coupling |

## Future Roadmap

### Phase 1: MVP Features (Current)
- [ ] 3-reel classic slot
- [ ] Single payline
- [ ] Basic RNG (simulated backend)
- [ ] Win detection
- [ ] Animations

### Phase 2: Modern Features
- [ ] Multiple paylines
- [ ] Bonus rounds
- [ ] Wild/Scatter symbols
- [ ] Multipliers
- [ ] Hold & Re-spin

### Phase 3: Advanced Mechanics
- [ ] Tumbling reels
- [ ] Collection features
- [ ] Dynamic multipliers
- [ ] Game shows integration

### Phase 4: Real Backend
- [ ] User accounts
- [ ] Real RNG server
- [ ] Credit system
- [ ] Transaction logging
- [ ] Leaderboards

### Phase 5: Polish
- [ ] Artwork integration
- [ ] Sound effects
- [ ] Mobile optimization
- [ ] Localization
- [ ] Responsive design

## Technology Stack

- **Frontend**: Vanilla JavaScript ES2022+
- **Graphics**: Pixi.js (2D) or Three.js (3D)
- **Animation**: GSAP
- **Build**: Vite
- **Testing**: Jest + Cypress
- **Backend** (future): Node.js/Express
- **Database** (future): PostgreSQL

## Security Considerations

### For Demo
- All RNG client-side (simulated backend)
- localStorage for balance (can be deleted)
- No real transactions

### For Production
- All RNG server-side
- Server validates every win
- Cryptographic signatures on outcomes
- Audit trail of all spins
- Regular RNG certification/auditing

## Contributing

(To be defined based on team structure)

## Resources

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed system design
- **[DECISIONS.md](./DECISIONS.md)** - Technical decisions log
- **[Real Slot Machine Research](./RESEARCH.md)** - Casino industry documentation

## License

MIT

## References

This project references real casino slot machine patterns:
- RNG certification requirements (ISO 13849-1, GLI-19)
- Payout calculation standards
- Game mechanics from Hacksaw Gaming and similar providers
- Real casino security practices

This is an **educational/demo project**, not intended for real gambling.

---

**Status**: 🟡 In Planning/Architecture phase
**Last Updated**: 2026-02-15
