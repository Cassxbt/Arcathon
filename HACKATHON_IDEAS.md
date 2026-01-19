# Agentic Commerce on Arc - Hackathon Ideas Bank

> **Hackathon:** Agentic Commerce on Arc (lablab.ai)
> **Dates:** January 9-24, 2026
> **Prize Pool:** $20,000 USDC + $10,000 GCP Credits
> **Core Tech:** Circle Arc Blockchain, USDC, x402 Protocol, AI Agents

---

## Selected Project: PayVoice

See `PRD.md` for full details on our chosen project.

---

## All Generated Ideas

### IDEA 1: PayVoice - Voice-Activated Payment Assistant [SELECTED]

**Tracks:** Best Autonomous Commerce + Best Product Design

**What It Does:**
A WhatsApp voice assistant that lets users:
- Send money by just saying "Send $50 to John"
- Pay bills by voice command
- Set up automatic payments
- Get balance updates spoken to them

**Why It Wins:**
- Accessibility - Helps people who can't read/type well
- Global reach - WhatsApp works everywhere, including developing countries
- Natural UX - Voice is the most intuitive interface
- Real utility - Solves actual problems
- Uses Circle Wallets + Arc for payments

**User Flow:**
```
User calls WhatsApp number
-> AI answers: "Hi! How can I help with payments today?"
-> User: "Send $20 to my mom for groceries"
-> AI: "Sending $20 USDC to Mom. Confirm by saying 'yes'"
-> User: "Yes"
-> AI: "Done! $20 sent. Her new balance is $150."
```

**Tech Stack:**
- ElevenLabs (Voice AI)
- WhatsApp Business API
- Circle Wallets
- Arc Blockchain
- Node.js Backend
- Supabase Database

---

### IDEA 2: MicroTask Agent - Pay-Per-Task AI Assistant

**Tracks:** Best Gateway-Based Micropayments + Best Trustless AI Agent

**What It Does:**
An AI assistant on WhatsApp that:
- Does tasks for users (research, booking, translations, etc.)
- Charges small amounts per task (micropayments)
- Users pre-load a balance, agent deducts as it works
- Fully automated billing

**Why It Wins:**
- Demonstrates x402 protocol beautifully
- Real micropayment use case
- Shows agent paying for APIs (research tools, etc.)
- Two-way commerce - user pays agent, agent pays services

**User Flow:**
```
User: "Find me the cheapest flight to Miami next week"
AI: "This search costs $0.10. You have $5.00 balance. Proceed?"
User: "Yes"
AI: *searches multiple APIs, pays each one micropayments*
AI: "Found it! Spirit Airlines, $89, departing Tuesday 6am."
```

**Key Innovation:**
The AI agent itself pays for external APIs using x402 micropayments, demonstrating true machine-to-machine commerce.

---

### IDEA 3: VoiceCommerce - Shop by Voice on WhatsApp

**Tracks:** Best Autonomous Commerce + Best Product Design

**What It Does:**
- User describes what they want to buy by voice
- AI finds products, compares prices
- User approves, AI makes payment
- Tracks delivery updates via voice

**Why It Wins:**
- E-commerce is huge - massive market
- Voice shopping is the future (think Alexa but on WhatsApp)
- Autonomous purchasing with user guardrails
- Practical and relatable

**User Flow:**
```
User: "I need new running shoes, size 10, under $100"
AI: "I found 3 options. Nike Air for $95, Adidas Ultra for $89,
     or New Balance for $75. Want details on any?"
User: "Get me the Adidas"
AI: "Adidas Ultra, $89 + $5 shipping. Pay from your wallet?"
User: "Yes"
AI: "Ordered! Arriving Thursday. I'll update you when it ships."
```

**Complexity:** High (requires merchant integrations)

---

### IDEA 4: FreelancePay - Voice-Based Gig Payment System

**Tracks:** Best Trustless AI Agent + Best Autonomous Commerce

**What It Does:**
- Freelancers and clients communicate via WhatsApp voice
- AI manages escrow and milestone payments
- Work verification triggers automatic payment release
- Dispute resolution via voice

**Why It Wins:**
- Solves real trust problems in freelance economy
- Escrow = trustless agent with onchain logic
- Global workforce can use WhatsApp
- Autonomous payment release

**User Flow:**
```
Client: "Create a $500 escrow for logo design with Sarah"
AI: "Escrow created. Sarah has been notified. 3 milestones set."

[After Sarah completes work]

Client: "Approve milestone 1"
AI: "Released $150 to Sarah. 2 milestones remaining."
```

**Smart Contract Potential:** Could use Arc smart contracts for escrow logic.

---

### IDEA 5: SubscriptionBot - Autonomous Subscription Manager

**Tracks:** Best Trustless AI Agent + Best Gateway-Based Micropayments

**What It Does:**
- Connects to your subscriptions (Netflix, Spotify, etc.)
- Monitors usage patterns
- Automatically pauses unused subscriptions
- Negotiates better deals
- All controlled via voice on WhatsApp

**Why It Wins:**
- Saves users money - high practical value
- Autonomous decision-making within guardrails
- Recurring payments = micropayments use case
- Policy-controlled spending

**User Flow:**
```
User: "What subscriptions am I paying for?"
AI: "You have 5 active: Netflix $15, Spotify $10, Gym $30..."
AI: "I noticed you haven't used your gym membership in 60 days. Want me to pause it?"
User: "Yes, pause it"
AI: "Paused. You'll save $30/month. I'll remind you if you want to restart."
```

---

### IDEA 6: RemitVoice - Voice Remittance for Families

**Tracks:** Best Product Design + Best Autonomous Commerce

**What It Does:**
- Send money to family abroad via voice command
- AI finds best exchange rates automatically
- Scheduled recurring payments ("Send $100 to Mom every month")
- Confirmation via voice in multiple languages

**Why It Wins:**
- $700 billion remittance market
- Financial inclusion - helps unbanked populations
- Multi-language voice (ElevenLabs supports 29 languages)
- Real social impact

**User Flow (in Spanish):**
```
User: "Envía cien dólares a mi mamá en México"
AI: "Enviando $100 a Mamá. El tipo de cambio hoy es 17.2 pesos por dólar.
     Ella recibirá 1,720 pesos. ¿Confirmas?"
User: "Sí"
AI: "¡Listo! El dinero llegará en 30 segundos."
```

---

### IDEA 7: API Wallet Agent - Machine-to-Machine Payments

**Tracks:** Best Gateway-Based Micropayments + Best Developer Tools

**What It Does:**
- AI agent that manages API spending for developers
- Automatically pays for premium APIs based on usage
- Tracks costs, optimizes spending
- Uses x402 for all API payments

**Why It Wins:**
- Perfect x402 demonstration
- Developer tools track - judges appreciate infra
- Solves real problem for AI developers
- Highly technical (impresses judges)

**Use Case:**
```
Developer configures agent with $50/month budget
Agent monitors AI app's API usage
When app needs GPT-4: Agent pays OpenAI via x402
When app needs image gen: Agent pays DALL-E via x402
Agent reports: "Spent $32.50 this month. Top cost: GPT-4 at $20."
```

---

### IDEA 8: TreasuryGuard - AI Treasury Management

**Tracks:** Best Trustless AI Agent

**What It Does:**
- Manages company/DAO treasury autonomously
- Auto-allocates idle USDC to yield-bearing instruments
- Executes pre-approved payments
- Human-in-the-loop for large decisions

**Why It Wins:**
- DeFi angle appeals to crypto judges
- Shows autonomous financial decision-making
- Strong governance/guardrails story
- Sophisticated use case

**Complexity:** High (requires DeFi integration)

---

### IDEA 9: SolarSettle - Energy Payment AI

**Tracks:** Best Autonomous Commerce

**What It Does:**
- AI agents verify and settle solar energy production
- Converts kWh to USDC-backed credits
- Automatic peer-to-peer energy trading
- Real-time settlement on Arc

**Why It Wins:**
- Climate/sustainability angle
- Real-world asset tokenization
- Autonomous verification and payment
- Unique niche

**Complexity:** Very High (requires IoT integration)

---

### IDEA 10: BudgetBuddy - Financial Literacy Voice Agent

**Tracks:** Best Product Design

**What It Does:**
- Teaches financial literacy through voice conversations
- Tracks spending and gives advice
- Gamified savings goals
- Gentle nudges via WhatsApp

**Why It Wins:**
- Strong social impact angle
- Accessibility for underserved populations
- Lower technical complexity
- Clear UX story

---

## Comparison Matrix

| Idea | Technical Difficulty | Impact | Uniqueness | Demo-ability | Recommended |
|------|---------------------|--------|------------|--------------|-------------|
| PayVoice | Medium | High | High | Excellent | YES |
| MicroTask Agent | Medium-High | High | Very High | Good | Maybe |
| VoiceCommerce | High | High | Medium | Good | No |
| FreelancePay | High | Medium | Medium | Medium | No |
| SubscriptionBot | Medium | Medium | Medium | Good | No |
| RemitVoice | Medium | Very High | High | Excellent | Maybe |
| API Wallet | High | Medium | Very High | Poor | No |
| TreasuryGuard | Very High | Medium | High | Medium | No |
| SolarSettle | Very High | High | Very High | Poor | No |
| BudgetBuddy | Low | Medium | Low | Good | No |

---

## Why PayVoice is the Winner

1. **Sweet Spot of Complexity** - Achievable in 2 weeks with basic coding
2. **Best Demo** - Can literally call it live in front of judges
3. **Clear Value Prop** - Everyone understands sending money
4. **Multiple Tracks** - Eligible for 2-3 prize categories
5. **Social Impact** - Accessibility angle for bonus points
6. **Uses All Required Tech** - Circle, Arc, USDC, AI Agent
7. **Google Bonus** - Easy to add Gemini for extra prize eligibility

---

## Future Ideas (Post-Hackathon)

If PayVoice wins, these could be follow-up products:

1. **PayVoice Business** - Merchant version for receiving payments
2. **PayVoice Remit** - Specialized for international transfers
3. **PayVoice Commerce** - Add shopping capabilities
4. **PayVoice SDK** - Let other developers add voice payments

---

*Saved for future reference. Return to this document if pivoting or expanding.*
